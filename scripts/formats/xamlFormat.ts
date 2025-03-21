import { Dictionary } from 'style-dictionary';
import type { Config, DesignToken, FormatFnArguments, LocalOptions, TransformedToken } from 'style-dictionary/types';
import { usesReferences, getReferences, fileHeader } from 'style-dictionary/utils';
import Color from 'tinycolor2';
import { create, fragment } from 'xmlbuilder2';
import { XmlBuilder } from 'xmlbuilder2/interfaces'
import { NodeType  } from "@oozcitak/dom/lib/dom/interfaces";

const ns_default = 'http://schemas.microsoft.com/winfx/2006/xaml/presentation'
const ns_system = 'clr-namespace:System;assembly=mscorlib';
const ns_x = 'http://schemas.microsoft.com/winfx/2006/xaml';

interface XamlFormatCallback {
    () : void
}

interface XamlTokenFormatter {
    (token: TransformedToken, formatArgs: FormatFnArguments, root: XmlBuilder) : XamlFormatCallback | undefined
}

interface XamlTokenFormatters {
    [type: string]: XamlTokenFormatter
}

export async function xamlFormat(args: FormatFnArguments): Promise<string> {
    const { dictionary, options } = args;
    
    const doc = create();
    if(options.showFileHeader && options.fileHeader) {
        if (typeof options.fileHeader === 'function') {
            const header = (await options.fileHeader(undefined, options))
                .reduce((a, b) => `${a}\n${b}`);
            doc.com(`\n${header}\n`);
        } else {
            doc.com(options.fileHeader)
            doc.com(`\n${fileHeader}\n`);
        }
    }

    const tokenFormatter: XamlTokenFormatters = {
        borderRadius,
        borderWidth,
        boxShadow,
        color,
        fontFamily,
        paragraphSpacing,
        spacing,
        typography,
        'dimension': simpleDouble,
        'opacity': simpleDouble,
        'sizing': simpleDouble,
    }

    const root = doc.ele(ns_default, 'ResourceDictionary', {
        'xmlns:x': ns_x,
        'xmlns:system': ns_system
    });

    const callbacks = dictionary.allTokens.map(token => {
        const type = options.usesDtcg ? token.$type : token.type;
        if (type) {
            const formatter = tokenFormatter[type];
            if (formatter) {
                if (token.$description !== undefined && !token.$description.match(/^\s*$/)) {
                    root.com(token.$description)
                }
                return formatter(token, args, root)
            }
        }
        return undefined;
    }).filter(cb => cb !== undefined);

    // run all the callbacks
    callbacks.forEach(cb => cb());

    const output = root.end({ prettyPrint: true, headless: true, spaceBeforeSlash: true })

    return output;
}

function original({original}: TransformedToken, options: Config & LocalOptions) {
    return value(original, options);
}

function value({$value, value}: DesignToken, {usesDtcg} : Config & LocalOptions ) {
    return usesDtcg ? $value : value;
}

function findNodeByKey(key: string, root: XmlBuilder) : XmlBuilder | undefined {
    return root.find((node : XmlBuilder) =>
        node.node.nodeType === NodeType.Element && node.node.getAttributeNS(ns_x, 'Key') === key)
} 

function spacing(token: TransformedToken, args: FormatFnArguments, root: XmlBuilder) :  XamlFormatCallback | undefined {
    const node = simpleDouble(token, args, root);

    const axis = token.path[token.path.length - 2];
    if (!axis || !(['x', 'y', 'xg', 'yg'].includes(axis))) return node;

    const key_prefix = token.path.slice(0, token.path.length - 2)
        .reduce((a: string, b: string) => `${a}${b[0]?.toUpperCase() + b.slice(1).toLowerCase()}`, '');
    let key_suffix = token.path.slice(token.path.length - 1)
        .reduce((a: string, b: string) => `${a}${b[0]?.toUpperCase() + b.slice(1).toLowerCase()}`, '');

    if (axis === 'xg' || axis === 'yg') {
        key_suffix = `Gap${key_suffix}`;
    }
    const key = key_prefix + key_suffix;

    return () => {
        let thickness = findNodeByKey(key, root) ?? root.ele(ns_default, 'Thickness').att(ns_x, 'Key', key)

        const ref = `{StaticResource ${token.name}}`
        if (axis[0] === 'x') {
            thickness.att({ 'Left': ref, 'Right': ref })
        } else if (axis[0] === 'y') {
            thickness.att({ 'Top': ref, 'Bottom': ref })
        }
    }
}

function fontFamily(token: TransformedToken, {options} : FormatFnArguments, root: XmlBuilder) :  XamlFormatCallback | undefined {
    root.ele(ns_default, 'FontFamily').txt(`fonts/#${value(token, options)}`).att(ns_x, 'Key', token.name);
    return undefined
}

function simpleDouble(token: TransformedToken, {options} : FormatFnArguments, root: XmlBuilder) :  XamlFormatCallback | undefined {
    root.ele(ns_system, 'Double').txt(value(token, options)).att(ns_x, 'Key', token.name);
    return undefined
}

function paragraphSpacing(token: TransformedToken, {options} : FormatFnArguments, root: XmlBuilder) :  XamlFormatCallback | undefined {
    root.ele(ns_default, 'Thickness', { Bottom: value(token, options) }).att(ns_x, 'Key', token.name);
    return undefined
}

function borderRadius(token: TransformedToken, {options} : FormatFnArguments, root: XmlBuilder) :  XamlFormatCallback | undefined {
    root.ele(ns_default, 'CornerRadius').txt(value(token, options)).att(ns_x, 'Key', token.name)
    return undefined
}

function borderWidth(token: TransformedToken, { options }: FormatFnArguments, root: XmlBuilder): XamlFormatCallback | undefined {
    root.ele(ns_default, 'Thickness').txt(value(token, options)).att(ns_x, 'Key', token.name)
    return undefined
}

const FontWeight : {[weight: number] : string | undefined} = {
    100: 'Thin',
    200: 'ExtraLight',
    300: 'Light',
    400: 'Normal',
    500: 'Medium',
    600: 'DemiBold',
    700: 'Bold',
    800: 'ExtraBold',
    900: 'Black',
    950: 'ExtraBlack',
}
function typography(token: TransformedToken, { dictionary, options }: FormatFnArguments, root: XmlBuilder): XamlFormatCallback | undefined {
    const { fontFamily, fontWeight, lineHeight, fontSize, paragraphSpacing, textDecoration } = value(token, options);

    const style = create().ele('Style').att(ns_x, 'Key', token.name).att('TargetType', 'TextBlock');
    if (fontFamily) {
        const key = `${token.name}_FontFamily`;
        root.ele(ns_default, 'FontFamily')
            .txt(`pack://application:,,,/Sage.DesignSystem.Theme;component/Fonts/#${fontFamily}`)
            .att(ns_x, 'Key', key)

        style.ele(ns_default, 'Setter', { 'Property': 'FontFamily', 'Value': `{StaticResource ${key}}`});
    }

    if (fontSize && !Number.isNaN(+fontSize)) {
        const key = `${token.name}_FontSize`;
        root.ele(ns_system, 'Double').att(ns_x, 'Key', key).txt(fontSize);
        style.ele(ns_default, 'Setter', { 'Property': 'FontSize', 'Value': `{StaticResource ${key}}`});
    }

    if (fontWeight) {
        const key = `${token.name}_FontWeight`;
        root.ele(ns_default, 'FontWeight').att(ns_x, 'Key', key).txt(FontWeight[fontWeight]);
        style.ele(ns_default, 'Setter', { 'Property': 'FontWeight', 'Value': `{StaticResource ${key}}`});
    }

    const lineHeightKey = `${token.name}_LineHeight`
    if (lineHeight && lineHeight > 0 && fontSize) {
        // TODO: handle css clamp() values
        // syntax: clamp(min, value, max)
        // clamps the value, which is generally a
        // dynamic/proportional value, between min and max
        root.ele(ns_system, 'Double').att(ns_x, 'Key', lineHeightKey).txt(fontSize * lineHeight);
    }
    else {
        root.ele(ns_system, 'String').att(ns_x, 'Key', lineHeightKey).txt('Auto');
    }
    style.ele(ns_default, 'Setter', { 'Property': 'LineHeight', 'Value': `{StaticResource ${lineHeightKey}}` });

    if (+paragraphSpacing) {
        const key = `${token.name}_ParagraphSpacing`
        root.ele(ns_default, 'Thickness', { 'Bottom': paragraphSpacing }).att(ns_x, 'Key', key);
        style.ele(ns_default, 'Setter', { 'Property': 'Padding', 'Value': `{StaticResource ${key}}`});
    }

    if (textDecoration) {
        const key = `${token.name}_TextDecorations`
        root.ele(ns_default, 'TextDecorationCollection').txt(textDecoration).att(ns_x, 'Key', key);
        style.ele(ns_default, 'Setter', { 'Property': 'TextDecorations', 'Value': `{StaticResource ${key}}`});
    }
    root.import(style);
    return undefined;
}

function boxShadow(token: TransformedToken, { options }: FormatFnArguments, root: XmlBuilder): XamlFormatCallback | undefined {
    let shadows = root.ele(ns_x, 'Array', { 'Type': 'DropShadowEffect' })
        .att(ns_x, 'Key', token.name);
    for (const { x, y, blur, color } of value(token, options)) {
        const depth = Math.sqrt((x * x) + (y * y));
        const angle = (360 - (Math.atan(y / x) * (180 / Math.PI))) % 360;
        const opacity = Color(color).getAlpha();
        const hex = `#${Color(color).toHex8().slice(0, 6)}`;
        shadows.ele(ns_default,
            'DropShadowEffect',
            {
                BlurRadius: blur,
                Direction: angle,
                ShadowDepth: depth,
                Color: hex,
                Opacity: opacity
            }
        );
    }
    return undefined;
}

function color(token: TransformedToken, { options }: FormatFnArguments, root: XmlBuilder): XamlFormatCallback | undefined {
    const _value = value(token, options);
    let g: RegExpMatchArray | undefined;
    if (g = _value.match(/linear-gradient\((\d+)deg,\s*(#[A-Fa-f0-9]+)\s+(\d+)%/)) {
        let gradient = root.ele(ns_default, 'LinearGradientBrush').att(ns_x, 'Key', `${token.name}Brush`);
        gradient.com(_value);

        let next = 0;
        const angle = +(g[1] ?? 0) / 180 * Math.PI;
        const h = Math.sqrt(2000);
        let x = Math.round(Math.sin(angle) * h);
        let y = Math.round(Math.cos(angle) * h);
        const max = Math.max(Math.abs(x), Math.abs(y));
        x = x / max; // normalize
        y = -y / max; // normalize and flip

        const startx = Math.abs(Math.min(0, x));
        const starty = Math.abs(Math.min(0, y));
        const endx = Math.max(0, x);
        const endy = Math.max(0, y);

        gradient.att('StartPoint', `${startx},${starty}`)
            .att('EndPoint', `${endx},${endy}`);

        let i = 0;
        do {
            next += (g.index ?? 0) + g[0].length;
            let color = Color(g[2]);
            let stop = `${+(g[3] ?? 0) / 100}`;
            const str = color.toHex8();
            var val = `#${str.slice(6)}${str.slice(0, 6)}`;

            gradient.ele(ns_default, 'GradientStop', { Color: val, Offset: stop });
            i++;
        } while (g = _value.slice(next).match(/(\s*)(#[A-Fa-f0-9]+)\s+(\d+)%/));

        return undefined;
    }

    const col = Color(_value);
    const str = col.toHex8();
    var val = `#${str.slice(6)}${str.slice(0, 6)}`;

    root.ele(ns_default, 'SolidColorBrush', { Color: val }).att(ns_x, 'Key', `${token.name}Brush`);
    return undefined
}
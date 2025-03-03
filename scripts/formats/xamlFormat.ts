import type { Dictionary, DesignToken, TransformedToken, PlatformConfig, File } from 'style-dictionary/types';
import { fileHeader, formattedVariables } from 'style-dictionary/utils';
import Color from 'tinycolor2';

export function xamlFormat({
    dictionary,
    options,
}): string {
    let output = `<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:system="clr-namespace:System;assembly=mscorlib">\n`;
    let spacings : {[k: string]: {x: string, y: string}} = {};
    for (const token of dictionary.allTokens) {
        if (token.$description !== undefined) {
            output += `<!-- ${token.$description} -->\n`;
        }

        switch (token.$type) {

            case 'borderRadius':
                output += `<CornerRadius x:Key="${token.name}">${token.$value}</CornerRadius>\n`;
                break;
            case 'borderWidth':
                output += `<Thickness x:Key="${token.name}">${token.$value}</Thickness>\n`;
                break;
            case 'boxShadow':
                output += `<!--\n TODO: <DropShadowEffect x:Key="${token.name}" BlurRadius="" Direction="" Color="" Opacity="">\n ${JSON.stringify(token.$value)}\n-->\n`;
                break;
            case 'color':
                const color = Color(options.usesDtcg ? token.$value : token.value);
                const str = color.toHex8();
                var val = `#${str.slice(6)}${str.slice(0,6)}`
                output += `<SolidColorBrush x:Key="${token.name}Brush" Color="${val}" />\n`;
                break;
            case 'dimension':
                output += `<system:Double x:Key="${token.name}">${token.$value}</system:Double>\n`;
                break;
            case 'fontFamily':
                output += `<FontFamily x:Key="${token.name}">fonts/#${token.$value}</FontFamily>\n`;
                break;
            case 'fontSizes':
                output += `<system:Double x:Key="${token.name}">${token.$value}</system:Double>\n`;
                break;
            case 'fontWeights':
                output += `<system:Double x:Key="${token.name}">${token.$value}</system:Double>\n`;
                break;
            case 'lineHeights':
                break;
            case 'opacity':
                output += `<system:Double x:Key="${token.name}">${token.$value}</system:Double>\n`;
                break;
            case 'other':
                output += `<system:Double x:Key="${token.name}">${token.$value}</system:Double>\n`;
                break;
            case 'paragraphSpacing':
                output += `<Thickness x:Key="${token.name}" Bottom="${token.$value}" />\n`;
                break;
            case 'sizing':
                output += `<system:Double x:Key="${token.name}">${token.$value}</system:Double>\n`;
                break;
            case 'spacing':
                var key = 
                token.path.slice(0, token.path.length-2).concat(token.path.slice(token.path.length-1)).reduce((a : string, b: string) => `${a}${b[0]?.toUpperCase() + b.slice(1).toLowerCase()}`, '');
                if(token.path[token.path.length-2] == 'x') {
                    let spacing = spacings[key] ?? {x: '', y: ''};
                    spacing.x = token.name;
                    spacings[key] = spacing;
                } else if (token.path[token.path.length-2] == 'y') {
                    let spacing = spacings[key] ?? {x: '', y: ''};
                    spacing.y = token.name;
                    spacings[key] = spacing;
                }
                output += `<system:Double x:Key="${token.name}">${token.$value}</system:Double>\n`;
                break;
            case 'textDecoration':
                output += `<TextDecoration x:Key="${token.name}" Location="${token.$value}" />\n`;
                break;
            case 'typography':
                output += `<!-- TODO: ${token.name} ${JSON.stringify(token.$value)} -->\n`;
                break;
        }
    }

    for (var k in spacings) {
       let spacing = spacings[k];
       output += `<Thickness x:Key="${k}"`;
       if( spacing?.x ) output += ` Left="{StaticResource ${spacing?.x}}" Right="{StaticResource ${spacing?.x}}"`;
       if( spacing?.y ) output += ` Top="{StaticResource ${spacing?.y}}" Bottom="{StaticResource ${spacing?.y}}"`;
       output += ` />\n`
    }
    output += "</ResourceDictionary>\n";
    return output;
}

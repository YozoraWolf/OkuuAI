import chalk from 'chalk';

let logo = `
\u001b[33m                                                                                                                                                                                                                                                                
    TBA
\u001b[0m`;

logo = chalk.hex("##FFA500").bold(logo);

let logo_txt = 
`                        
      ::::::::  :::    ::: :::    ::: :::    :::              :::     :::::::::::
    :+:    :+: :+:   :+:  :+:    :+: :+:    :+:            :+: :+:       :+:     
   +:+    +:+ +:+  +:+   +:+    +:+ +:+    +:+           +:+   +:+      +:+      
  +#+    +:+ +#++:++    +#+    +:+ +#+    +:+          +#++:++#++:     +#+       
 +#+    +#+ +#+  +#+   +#+    +#+ +#+    +#+          +#+     +#+     +#+        
#+#    #+# #+#   #+#  #+#    #+# #+#    #+#          #+#     #+#     #+#         
########  ###    ###  ########   ########           ###     ### ###########      
`;

logo_txt = chalk.hex("##FFA500").bold(logo_txt);

const centerLogo = (logo: string): string => {
    const terminalWidth = process.stdout.columns || 80; // set default value if process.stdout.columns is undefined (unlikely)
    const logoLines = logo.split('\n');
    const centeredLogoLines = logoLines.map(line => {
        const padding = ' '.repeat(Math.max(0, Math.round((terminalWidth - line.length) / 2))); // use Math.max to ensure padding is not negative
        const centeredLine = padding + line;
        return centeredLine;
    });
    return centeredLogoLines.join('\n');
};

export const centeredLogo = centerLogo(logo);
export const centeredLogoTxt = centerLogo(logo_txt);
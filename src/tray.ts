import SysTray from 'systray';
import fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let systray;

export const initTray = async () => {
    // Read the SVG file as a buffer
    const svgBuffer = fs.readFileSync('./src/assets/radioa_d.svg');

    // Convert the buffer to a base64 string
    const b64ico = svgBuffer.toString('base64');

    systray = new SysTray({
        menu: {
            // you should using .png icon in macOS/Linux, but .ico format in windows
            icon: b64ico,
            title: "OkuuAI",
            tooltip: "Interact with OkuuAI here!",
            items: [
                {
                    title: "Exit",
                    tooltip: "Close OkuuAI",
                    checked: false,
                    enabled: true
                }]
        },
        debug: false,
        copyDir: true,
    });
};

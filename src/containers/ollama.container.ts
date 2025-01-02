import { DockerContainer, ContainerStatus } from './container.class';
import { ConsoleColor, Logger } from '../logger';

class OllamaContainer extends DockerContainer {

    constructor(containerName: string, imageName: string, port: number) {
        super(containerName, imageName, port);
    }

    /**
     * Initialize the container by checking if the image is pulled,
     * pulling it if necessary, and starting the container.
     */
    async init(): Promise<void> {
        try {
            Logger.INFO(`Checking if image ${this.imageName} is pulled...`);
            const imagePulled = await this.isImagePulled();
            if (!imagePulled) {
                Logger.INFO(`Image ${this.imageName} not found. Pulling image...`);
                await this.pullContainer(this.imageName);
                Logger.INFO(`Image ${this.imageName} pulled successfully.`);
            } else {
                Logger.INFO(`Image ${this.imageName} is already pulled.`);
            }



            const status = await this.getContainerStatus();
            if (status === ContainerStatus.Running) {
                Logger.INFO(`Container ${this.containerName} is running.`);
            } else {
                // Attempt to start the container
                Logger.INFO(`Starting container ${this.containerName}...`);
                await this.runContainer();
            }
        } catch (error: any) {
            Logger.ERROR(`${ConsoleColor.FgRed}Error during ollama initialization: ${error.message}`);
        }
        Logger.INFO(`${ConsoleColor.FgGreen}Ollama container initialized.`);
    }

    /**
     * Check if the Docker image is already pulled.
     * @returns {Promise<boolean>} True if the image is pulled, false otherwise.
     */
    private async isImagePulled(): Promise<boolean> {
        try {
            const result = await this.docker.command(`images -q ${this.imageName}`);
            return result.raw.trim().length > 0;
        } catch (error) {
            return false;
        }
    }
}

export { OllamaContainer };

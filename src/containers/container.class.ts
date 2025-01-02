import { Logger } from '@src/logger';
import { Docker } from 'docker-cli-js';

enum ContainerStatus {
    Running = 'running',
    Exited = 'exited',
    NotFound = 'not_found',
    Unknown = 'unknown'
}

class DockerContainer {
    protected docker: Docker;
    protected imageName: string;
    protected containerName: string;

    protected port: number;

    constructor(imageName:string, containerName: string, port: number) {
        this.docker = new Docker({
            echo: false
        });
        this.imageName = imageName;
        this.containerName = containerName;

        this.port = port;
    }

    async containerExists(): Promise<boolean> {
        try {
            const result = await this.docker.command(`inspect ${this.containerName}`);
            return result.object.length > 0;
        } catch (error) {
            return false;
        }
    }

    async isContainerStarted(): Promise<boolean> {
        const status = await this.getContainerStatus();
        return status === ContainerStatus.Running;
    }

    async runContainer(): Promise<void> {
        if(!(await this.containerExists()) && !(await this.isContainerStarted())) {
            await this.docker.command(`run -d -p ${this.port}:${this.port} --name ${this.containerName} ${this.imageName}`);
        } else {
            await this.startContainer();
        }
    }

    async startContainer(): Promise<void> {
        await this.docker.command(`start ${this.containerName}`);
    }

    async restartContainer(): Promise<void> {
        await this.docker.command(`restart ${this.containerName}`);
    }

    async stopContainer(): Promise<void> {
        await this.docker.command(`stop ${this.containerName}`);
    }

    async getContainerStatus(): Promise<ContainerStatus> {
        try {
            const result = await this.docker.command(`inspect ${this.containerName} --`);
            const containerInfo = JSON.parse(result.raw); // Parse the JSON response
            const containerStatus = containerInfo[0]?.State?.Status;
            switch (containerStatus) {
                case 'running':
                    return ContainerStatus.Running;
                case 'exited':
                    return ContainerStatus.Exited;
                default:
                    return ContainerStatus.Unknown;
            }
        } catch (error: any) {
            //Logger.ERROR(`Error getting container status: ${error}`);
            return ContainerStatus.NotFound;
        }
    }

    async pullContainer(imageName: string): Promise<void> {
        await this.docker.command(`pull ${imageName}`);
    }
}

export { DockerContainer, ContainerStatus };
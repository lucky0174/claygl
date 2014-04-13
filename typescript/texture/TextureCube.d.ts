///<reference path="../Texture.d.ts" />
declare module qtek {

    export module texture {

        interface ITextureCubeImages = {
            px: HTMLElement;
            py: HTMLElement;
            pz: HTMLElement;
            nx: HTMLElement;
            ny: HTMLElement;
            nz: HTMLElement;
        }
        
        interface ITextureCubePixels = {
            px: ArrayBufferView;
            py: ArrayBufferView;
            pz: ArrayBufferView;
            nx: ArrayBufferView;
            ny: ArrayBufferView;
            nz: ArrayBufferView;
        }

        interface ITextureCubeImageSrc = {
            px: string;
            py: string;
            pz: string;
            nx: string;
            ny: string;
            nz: string;
        }
        
        interface ITextureCubeOption extends ITextureOption {
            image?: ITextureCubeImages;
            pixels?: ITextureCubePixels
        }

        export class Texture2D extends Texture {

            constructor(option?: ITextureCubeOption);

            image: ITextureCubeImages;

            pixels: ITextureCubePixels;

            update(gl: WebGLRenderingContext): void;

            generateMipmap(gl: WebGLRenderingContext): void;

            isPowerOfTwo(): boolean;

            isRenderable(): boolean;

            bind(gl): boolean;

            unbind(gl): boolean;

            load(imageList: ITextureCubeImageSrc): void;
        }
    }
}
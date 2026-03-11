import primaryColorsJson from '../assets/primaryColors.json'
import surfaceColorsJson from '../assets/surfaceColors.json'

export interface PrimaryColor {
    name: string
    palette: Record<string, string>
}

export interface SurfaceColor {
    name: string
    palette: Record<string, string>
}

export const primaryColors: PrimaryColor[] = primaryColorsJson

export const surfaceColors: SurfaceColor[] = surfaceColorsJson

/** Get the display color for a primary color swatch button */
export function getPrimaryDisplayColor(color: PrimaryColor): string {
    if (color.name === 'noir') return 'var(--p-text-color)'
    return color.palette['500']
}

/** Get the display color for a surface color swatch button */
export function getSurfaceDisplayColor(color: SurfaceColor): string {
    return color.palette['500']
}

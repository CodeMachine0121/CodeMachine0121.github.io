export interface Blog {
    id: string;
    slug: string;
    body: string;
    data: {
        title: string;
        description: string;
        datetime: string;
        image?: string;
        isEnabled: boolean;
        parent?: string;
        seriesIndex?: number;
    }
}

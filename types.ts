export interface Memory {
    id: string;
    imageUrl: string;
    text: string;
    createdAt: Date;
}

export interface UserType {
    uid: string;
    email: string | null;
}

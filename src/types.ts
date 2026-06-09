export interface AudioPicture {
  format: string;
  type: string;
  description: string;
  data: Uint8Array;
  base64?: string;
}

export interface AudioTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  picture?: AudioPicture;
}

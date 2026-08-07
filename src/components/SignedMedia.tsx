import { useSignedUrl } from '@/lib/signedUrl';

type ImgProps = React.ImgHTMLAttributes<HTMLImageElement> & { src: string | null | undefined };
export function SignedImg({ src, ...rest }: ImgProps) {
  const url = useSignedUrl(src);
  if (!url) return <div className={rest.className} style={{ ...(rest.style || {}), background: 'hsl(var(--muted))' }} />;
  return <img {...rest} src={url} />;
}

type VideoProps = React.VideoHTMLAttributes<HTMLVideoElement> & { src: string | null | undefined };
export function SignedVideo({ src, ...rest }: VideoProps) {
  const url = useSignedUrl(src);
  if (!url) return null;
  return <video {...rest} src={url} />;
}

type AudioProps = React.AudioHTMLAttributes<HTMLAudioElement> & { src: string | null | undefined };
export function SignedAudio({ src, ...rest }: AudioProps) {
  const url = useSignedUrl(src);
  if (!url) return null;
  return <audio {...rest} src={url} />;
}

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { src: string | null | undefined };
export function SignedLink({ src, children, ...rest }: LinkProps) {
  const url = useSignedUrl(src);
  return (
    <a {...rest} href={url ?? undefined} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

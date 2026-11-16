import { SaveButton } from './JobDetail';
/** Tiny island so pre-rendered job pages ship almost no JavaScript. */
export default function SaveIsland(props: { id: string; title: string; company: string }) {
  return <SaveButton {...props} />;
}

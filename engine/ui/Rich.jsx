import { mini } from '../core/md.js';

/** Текст с формулами. */
export function Rich({ text, class: cls = '', as: Tag = 'p' }) {
  return <Tag class={cls} dangerouslySetInnerHTML={{ __html: mini(text) }} />;
}

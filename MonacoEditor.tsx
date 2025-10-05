import {once} from 'lodash';
import {useRef, useState, useEffect, CSSProperties} from 'react';
import type * as monacoTypes from 'monaco-editor';

export const loadMonaco = once(async () => {
  const monaco = await import('monaco-editor/esm/vs/editor/editor.api');
  await Promise.all([
    // @ts-ignore
    import('monaco-editor/esm/vs/editor/editor.all.css'),
    import('monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'),
    import('monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'),
    import('monaco-editor/esm/vs/editor/contrib/find/browser/findController'),
    import('monaco-editor/esm/vs/editor/contrib/folding/browser/folding')
  ]);
  return monaco;
});

export interface MonacoEditorProps extends monacoTypes.editor.IStandaloneEditorConstructionOptions {
  style?: CSSProperties;
  className?: string;
  loadingText?: string;
  onEditor?: (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: typeof monacoTypes) => void;
}

export const DEFAULT_PROPS: monacoTypes.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true
};

export function MonacoEditor({style, className, loadingText = 'Loading editor...', onEditor, ...options}: MonacoEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let editor: monacoTypes.editor.IStandaloneCodeEditor | null = null;

    (async () => {
      setLoading(true);
      const monaco = await loadMonaco();

      if (ref.current) {
        editor = monaco.editor.create(ref.current, {...DEFAULT_PROPS, ...options});
        onEditor?.(editor, monaco);
      }

      setLoading(false);
    })();

    return () => editor?.dispose();
  }, []);

  return (
    <div style={style} className={className}>
      {loading && loadingText && <>{loadingText}</>}
      <div ref={ref} style={{height: '100%', width: '100%'}} />
    </div>
  );
}

import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import builtinModules from 'builtin-modules';

export default [
  {
    input: 'src/client/index.js',
    plugins: [nodeResolve({ preferBuiltins: false, browser: true }), commonjs()],
    output: [
      {
        format: 'esm',
        file: 'dist/client.mjs'
      },
      {
        format: 'cjs',
        file: 'dist/client.js'
      }
    ],
    // Suppress "`this` has been rewritten to `undefined`" warnings
    onwarn: (warning, defaultHandler) => {
      if (warning.code === 'THIS_IS_UNDEFINED') return;
      defaultHandler(warning);
    }
  },
  {
    input: 'src/server/index.js',
    external: builtinModules,
    plugins: [nodeResolve({ preferBuiltins: true }), commonjs()],
    output: [
      {
        format: 'esm',
        file: 'dist/server.mjs'
      },
      {
        format: 'cjs',
        file: 'dist/server.js'
      }
    ]
  }
];

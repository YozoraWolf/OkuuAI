import { boot } from 'quasar/wrappers';
import scaleDirective from 'src/directives/scale';

export default boot(({ app }) => {
  app.directive('scale', scaleDirective);
});
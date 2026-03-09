import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { finalize } from "rxjs/operators";
import { SpinnerService } from "../services/spinner.service";

/**
 * HTTP Interceptor that automatically shows/hides the spinner during HTTP requests
 *
 * Usage: Add to app.config.ts providers:
 * provideHttpClient(withInterceptors([spinnerInterceptor]))
 */
export const spinnerInterceptor: HttpInterceptorFn = (req, next) => {
  const spinnerService = inject(SpinnerService);

  // Skip spinner for certain endpoints if needed
  const skipSpinner = req.headers.has("X-Skip-Spinner");

  if (!skipSpinner) {
    spinnerService.show();
  }

  return next(req).pipe(
    finalize(() => {
      if (!skipSpinner) {
        spinnerService.hide();
      }
    }),
  );
};

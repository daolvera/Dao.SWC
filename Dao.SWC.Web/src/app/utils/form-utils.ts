/**
 * Utility class for common form operations
 */
export class FormUtils {
  /**
   * Mark all form controls as touched
   * Useful for showing validation errors after submit attempt
   *
   * @param form - FormGroup to mark as touched
   * @example
   * ```typescript
   * onSubmit() {
   *   if (this.form.invalid) {
   *     FormUtils.markAllAsTouched(this.form);
   *     return;
   *   }
   *   // Process form
   * }
   * ```
   */
  static markAllAsTouched(form: any): void {
    Object.keys(form.controls).forEach((key) => {
      const control = form.get(key);
      control?.markAsTouched();

      if (control && typeof control === "object" && "controls" in control) {
        this.markAllAsTouched(control);
      }
    });
  }

  /**
   * Get all validation errors from a form
   *
   * @param form - FormGroup to get errors from
   * @returns Object with control names as keys and error messages as values
   * @example
   * ```typescript
   * const errors = FormUtils.getAllErrors(this.form);
   * console.log(errors); // { email: 'Email is required', password: 'Password must be at least 8 characters' }
   * ```
   */
  static getAllErrors(form: any): { [key: string]: string[] } {
    const errors: { [key: string]: string[] } = {};

    Object.keys(form.controls).forEach((key) => {
      const control = form.get(key);
      const controlErrors = control?.errors;

      if (controlErrors) {
        errors[key] = Object.keys(controlErrors).map((errorKey) => {
          return this.getErrorMessage(key, errorKey, controlErrors[errorKey]);
        });
      }

      if (control && typeof control === "object" && "controls" in control) {
        const nestedErrors = this.getAllErrors(control);
        Object.keys(nestedErrors).forEach((nestedKey) => {
          errors[`${key}.${nestedKey}`] = nestedErrors[nestedKey];
        });
      }
    });

    return errors;
  }

  /**
   * Get a user-friendly error message for a validation error
   *
   * @param fieldName - Name of the field
   * @param errorKey - Error key (e.g., 'required', 'email')
   * @param errorValue - Error value object
   * @returns Formatted error message
   */
  static getErrorMessage(
    fieldName: string,
    errorKey: string,
    errorValue: any,
  ): string {
    const fieldLabel = this.formatFieldName(fieldName);

    const errorMessages: {
      [key: string]: (field: string, value: any) => string;
    } = {
      required: (field) => `${field} is required`,
      email: (field) => `${field} must be a valid email address`,
      minlength: (field, value) =>
        `${field} must be at least ${value.requiredLength} characters`,
      maxlength: (field, value) =>
        `${field} must not exceed ${value.requiredLength} characters`,
      min: (field, value) => `${field} must be at least ${value.min}`,
      max: (field, value) => `${field} must not exceed ${value.max}`,
      pattern: (field) => `${field} format is invalid`,
      matchesField: (field, value) =>
        `${field} must match ${this.formatFieldName(value.field)}`,
      phoneNumber: (field) => `${field} must be a valid phone number`,
      strongPassword: (field) =>
        `${field} must contain uppercase, lowercase, number, and special character`,
      url: (field) => `${field} must be a valid URL`,
      creditCard: (field) => `${field} must be a valid credit card number`,
      minAge: (field, value) => `Minimum age is ${value.required} years`,
      fileSize: (field, value) =>
        `File size must not exceed ${value.maxSize}MB`,
      fileExtension: (field, value) =>
        `Allowed file types: ${value.allowed.join(", ")}`,
      range: (field, value) =>
        `${field} must be between ${value.min} and ${value.max}`,
      alphanumeric: (field) => `${field} must contain only letters and numbers`,
      noWhitespace: (field) => `${field} cannot contain spaces`,
    };

    const messageGenerator = errorMessages[errorKey];
    if (messageGenerator) {
      return messageGenerator(fieldLabel, errorValue);
    }

    return `${fieldLabel} is invalid`;
  }

  /**
   * Convert camelCase or snake_case field name to Title Case
   *
   * @param fieldName - Field name to format
   * @returns Formatted field name
   */
  private static formatFieldName(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Reset form to initial state
   *
   * @param form - FormGroup to reset
   * @example
   * ```typescript
   * FormUtils.resetForm(this.form);
   * ```
   */
  static resetForm(form: any): void {
    form.reset();
    Object.keys(form.controls).forEach((key) => {
      const control = form.get(key);
      control?.setErrors(null);
      control?.markAsUntouched();
      control?.markAsPristine();
    });
  }

  /**
   * Check if a form control has a specific error and has been touched
   *
   * @param form - FormGroup
   * @param controlName - Name of the control
   * @param errorName - Name of the error to check
   * @returns True if control has the error and has been touched
   * @example
   * ```html
   * <div *ngIf="hasError(form, 'email', 'required')" class="text-danger">
   *   Email is required
   * </div>
   * ```
   */
  static hasError(form: any, controlName: string, errorName: string): boolean {
    const control = form.get(controlName);
    return !!(control && control.hasError(errorName) && control.touched);
  }

  /**
   * Check if a form control is invalid and touched
   *
   * @param form - FormGroup
   * @param controlName - Name of the control
   * @returns True if control is invalid and touched
   */
  static isInvalid(form: any, controlName: string): boolean {
    const control = form.get(controlName);
    return !!(control && control.invalid && control.touched);
  }

  /**
   * Check if a form control is valid and touched
   *
   * @param form - FormGroup
   * @param controlName - Name of the control
   * @returns True if control is valid and touched
   */
  static isValid(form: any, controlName: string): boolean {
    const control = form.get(controlName);
    return !!(control && control.valid && control.touched);
  }
}

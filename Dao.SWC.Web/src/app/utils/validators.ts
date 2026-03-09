import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

/**
 * Collection of custom form validators
 */
export class CustomValidators {
  /**
   * Validator to check if value matches another control's value
   * Useful for password confirmation fields
   *
   * @example
   * ```typescript
   * password: ['', Validators.required],
   * confirmPassword: ['', [Validators.required, CustomValidators.matchesField('password')]]
   * ```
   */
  static matchesField(fieldName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.parent) {
        return null;
      }

      const matchingControl = control.parent.get(fieldName);
      if (!matchingControl) {
        return null;
      }

      if (control.value !== matchingControl.value) {
        return { matchesField: { field: fieldName } };
      }

      return null;
    };
  }

  /**
   * Validator for phone numbers (basic US format)
   * Accepts: (123) 456-7890, 123-456-7890, 1234567890
   *
   * @example
   * ```typescript
   * phone: ['', [Validators.required, CustomValidators.phoneNumber()]]
   * ```
   */
  static phoneNumber(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const phoneRegex =
        /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
      const valid = phoneRegex.test(control.value);

      return valid ? null : { phoneNumber: true };
    };
  }

  /**
   * Validator for strong passwords
   * Requires: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
   *
   * @example
   * ```typescript
   * password: ['', [Validators.required, CustomValidators.strongPassword()]]
   * ```
   */
  static strongPassword(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const hasUpperCase = /[A-Z]/.test(control.value);
      const hasLowerCase = /[a-z]/.test(control.value);
      const hasNumeric = /[0-9]/.test(control.value);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(control.value);
      const isLengthValid = control.value.length >= 8;

      const passwordValid =
        hasUpperCase &&
        hasLowerCase &&
        hasNumeric &&
        hasSpecialChar &&
        isLengthValid;

      return passwordValid
        ? null
        : {
            strongPassword: {
              hasUpperCase,
              hasLowerCase,
              hasNumeric,
              hasSpecialChar,
              isLengthValid,
            },
          };
    };
  }

  /**
   * Validator for URLs
   *
   * @example
   * ```typescript
   * website: ['', [Validators.required, CustomValidators.url()]]
   * ```
   */
  static url(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      try {
        new URL(control.value);
        return null;
      } catch {
        return { url: true };
      }
    };
  }

  /**
   * Validator for credit card numbers (Luhn algorithm)
   *
   * @example
   * ```typescript
   * cardNumber: ['', [Validators.required, CustomValidators.creditCard()]]
   * ```
   */
  static creditCard(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const value = control.value.replace(/\D/g, "");

      if (value.length < 13 || value.length > 19) {
        return { creditCard: true };
      }

      // Luhn algorithm
      let sum = 0;
      let isEven = false;

      for (let i = value.length - 1; i >= 0; i--) {
        let digit = parseInt(value.charAt(i), 10);

        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }

        sum += digit;
        isEven = !isEven;
      }

      return sum % 10 === 0 ? null : { creditCard: true };
    };
  }

  /**
   * Validator for minimum age requirement
   *
   * @param minAge - Minimum age required
   * @example
   * ```typescript
   * birthDate: ['', [Validators.required, CustomValidators.minAge(18)]]
   * ```
   */
  static minAge(minAge: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const birthDate = new Date(control.value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      const actualAge =
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
          ? age - 1
          : age;

      return actualAge >= minAge
        ? null
        : { minAge: { required: minAge, actual: actualAge } };
    };
  }

  /**
   * Validator for file size
   *
   * @param maxSizeInMB - Maximum file size in megabytes
   * @example
   * ```typescript
   * file: ['', [Validators.required, CustomValidators.fileSize(5)]]
   * ```
   */
  static fileSize(maxSizeInMB: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const file = control.value as File;

      if (!file) {
        return null;
      }

      const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

      if (file.size > maxSizeInBytes) {
        return {
          fileSize: {
            maxSize: maxSizeInMB,
            actualSize: (file.size / 1024 / 1024).toFixed(2),
          },
        };
      }

      return null;
    };
  }

  /**
   * Validator for allowed file extensions
   *
   * @param allowedExtensions - Array of allowed extensions (e.g., ['jpg', 'png'])
   * @example
   * ```typescript
   * file: ['', [Validators.required, CustomValidators.fileExtension(['pdf', 'doc', 'docx'])]]
   * ```
   */
  static fileExtension(allowedExtensions: string[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const file = control.value as File;

      if (!file) {
        return null;
      }

      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        return {
          fileExtension: {
            allowed: allowedExtensions,
            actual: fileExtension,
          },
        };
      }

      return null;
    };
  }

  /**
   * Validator for numeric range
   *
   * @param min - Minimum value
   * @param max - Maximum value
   * @example
   * ```typescript
   * age: ['', [Validators.required, CustomValidators.range(1, 120)]]
   * ```
   */
  static range(min: number, max: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value && control.value !== 0) {
        return null;
      }

      const value = Number(control.value);

      if (isNaN(value) || value < min || value > max) {
        return { range: { min, max, actual: value } };
      }

      return null;
    };
  }

  /**
   * Validator for alphanumeric characters only
   *
   * @example
   * ```typescript
   * username: ['', [Validators.required, CustomValidators.alphanumeric()]]
   * ```
   */
  static alphanumeric(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const alphanumericRegex = /^[a-zA-Z0-9]+$/;
      const valid = alphanumericRegex.test(control.value);

      return valid ? null : { alphanumeric: true };
    };
  }

  /**
   * Validator for no whitespace
   *
   * @example
   * ```typescript
   * username: ['', [Validators.required, CustomValidators.noWhitespace()]]
   * ```
   */
  static noWhitespace(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const hasWhitespace = /\s/.test(control.value);

      return hasWhitespace ? { noWhitespace: true } : null;
    };
  }
}

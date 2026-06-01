export type HajjUmrahFormFields = {
  fullName: string;
  phoneCode: string;
  phoneNumber: string;
  email: string;
  travelDate: string;
  departureCity: string;
  travelers: string | number;
  nationality: string;
  remarks?: string;
};

export type HajjUmrahValidatedFields = {
  fullName: string;
  phoneCode: string;
  phoneNumber: string;
  phone: string;
  email: string;
  travelDate: string;
  departureCity: string;
  travelers: number;
  nationality: string;
  remarks: string;
};

export type HajjUmrahFieldErrors = Partial<
  Record<keyof HajjUmrahFormFields, string>
>;

export type HajjUmrahValidationResult =
  | {
      ok: true;
      data: HajjUmrahValidatedFields;
      errors: HajjUmrahFieldErrors;
    }
  | {
      ok: false;
      data: null;
      errors: HajjUmrahFieldErrors;
    };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneCodePattern = /^\+[1-9]\d{0,3}$/;
const phoneRawPattern = /^[0-9\s-]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function validateHajjUmrahFields(
  fields: Partial<HajjUmrahFormFields>,
): HajjUmrahValidationResult {
  const errors: HajjUmrahFieldErrors = {};
  const fullName = cleanText(fields.fullName);
  const phoneCode = cleanText(fields.phoneCode);
  const phoneNumberRaw = cleanText(fields.phoneNumber);
  const phoneNumber = phoneNumberRaw.replace(/[\s-]/g, "");
  const email = cleanText(fields.email).toLowerCase();
  const travelDate = cleanText(fields.travelDate);
  const departureCity = cleanText(fields.departureCity);
  const nationality = cleanText(fields.nationality);
  const remarks = cleanText(fields.remarks);
  const travelersRaw =
    typeof fields.travelers === "number"
      ? String(fields.travelers)
      : cleanText(fields.travelers);

  if (fullName.length < 2 || fullName.length > 120) {
    errors.fullName = "Enter a valid name.";
  }

  if (!phoneCodePattern.test(phoneCode)) {
    errors.phoneCode = "Enter a valid dialing code.";
  }

  if (
    !phoneRawPattern.test(phoneNumberRaw) ||
    phoneNumber.length < 6 ||
    phoneNumber.length > 15
  ) {
    errors.phoneNumber = "Enter digits only.";
  }

  if (!emailPattern.test(email) || email.length > 180) {
    errors.email = "Enter a valid email address.";
  }

  if (!datePattern.test(travelDate) || Number.isNaN(Date.parse(travelDate))) {
    errors.travelDate = "Select a valid date.";
  }

  if (departureCity.length < 2 || departureCity.length > 120) {
    errors.departureCity = "Enter a valid departure city.";
  }

  if (!/^\d+$/.test(travelersRaw)) {
    errors.travelers = "Enter travellers as a number.";
  }

  const travelers = Number(travelersRaw);

  if (
    !Number.isInteger(travelers) ||
    travelers < 1 ||
    travelers > 500
  ) {
    errors.travelers = "Travellers must be between 1 and 500.";
  }

  if (nationality.length < 2 || nationality.length > 120) {
    errors.nationality = "Enter a valid nationality.";
  }

  if (remarks.length > 800) {
    errors.remarks = "Remarks must be 800 characters or less.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, data: null, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      fullName,
      phoneCode,
      phoneNumber,
      phone: `${phoneCode} ${phoneNumber}`,
      email,
      travelDate,
      departureCity,
      travelers,
      nationality,
      remarks,
    },
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

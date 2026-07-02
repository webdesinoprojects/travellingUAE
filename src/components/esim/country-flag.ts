export type CountryFlagDisplay =
  | {
      kind: "image";
      src: string;
      alt: string;
    }
  | {
      kind: "badge";
      label: string;
    };

export function getCountryFlagDisplay(input: {
  isoCode: string;
  countryName: string;
  flagUrl: string | null | undefined;
  imageFailed?: boolean;
}): CountryFlagDisplay {
  const safeFlagUrl = getSafeAirhubFlagUrl(input.flagUrl);

  if (safeFlagUrl && !input.imageFailed) {
    return {
      kind: "image",
      src: safeFlagUrl,
      alt: `${input.countryName} flag`,
    };
  }

  return {
    kind: "badge",
    label: input.isoCode,
  };
}

export function getSafeAirhubFlagUrl(flagUrl: string | null | undefined) {
  const trimmed = flagUrl?.trim();

  if (!trimmed) {
    return null;
  }

  return encodeURI(trimmed);
}

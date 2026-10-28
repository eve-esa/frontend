import darkLogo from "@/assets/images/esa_phi_lab_1.svg";
import lightLogo from "@/assets/images/esa_phi_lab_ds.svg";
import { useTheme } from "@/hooks/useTheme";

/**
 * The ESA and Phi-lab logo. ESA guidelines: the white logotype on dark
 * backgrounds, the Deep Space one on light. The light file is the dark one
 * with the white ESA logotype recoloured to Deep Space (#003247); the Phi-lab
 * tag is unchanged.
 */
export const EsaPhiLabLogo = ({ className }: { className?: string }) => {
  const { resolved } = useTheme();
  return (
    <img
      src={resolved === "light" ? lightLogo : darkLogo}
      alt="logo"
      className={className}
      data-testid="brand-logo"
    />
  );
};

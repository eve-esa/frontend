import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/Button";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

export const ErrorMessage = ({ onRetry }: { onRetry: () => void }) => {
  const contactUrl = import.meta.env.VITE_CONTACT_URL;

  const onContactClick = () => {
    window.open(contactUrl, "_blank");
  };

  return (
    <div className="flex h-full flex-col justify-center md:flex-row  md:justify-between bg-danger-500/10 rounded-lg p-4 border border-danger-500 gap-4">
      <div className="flex items-center justify-center gap-4">
        <div>
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            className="text-danger-500 !h-12 !w-12"
          />
        </div>

        <p>
          There was an error processing your request. If the error persists,
          please contact support.
        </p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="flex cursor-pointer relative group transition-all duration-300 ease-in-out hover:text-natural-200">
          <span onClick={onContactClick} className="whitespace-nowrap">
            Contact us
            <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-natural-200 transition-all duration-300 ease-in-out group-hover:w-full group-hover:left-0"></span>
          </span>
        </div>
        <Button variant="outline" size="md" className="px-4" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
};

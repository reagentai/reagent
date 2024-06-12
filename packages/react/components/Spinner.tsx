import { HiOutlineRefresh } from "react-icons/hi";

const Spinner = (props: any) => {
  return (
    <div className={props.className}>
      <HiOutlineRefresh />
    </div>
  );
};

export { Spinner };

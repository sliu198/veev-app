export default function ModeButton({mode: {id, name}, activateMode, disabled, ...restProps}) {

  return <button
    onClick={() => activateMode(id)}
    disabled={disabled}
    {...restProps}
  >
    {name}
  </button>
}
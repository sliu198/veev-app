import * as classes from './ModeControl.module.css'
import {useCallback} from "react";

export default function ModeControl({mode: {id, name}, activateMode, disabled, className, ...restProps}) {
  className = [classes.ModeControl, className].join(' ');

  useCallback(() => activateMode(id), [activateMode, id]);

  return <label className={className} {...restProps}>
    <button
      className={classes.ModeControlButton}
      onClick={() => activateMode(id)}
      disabled={disabled}
    />
    {name}
  </label>

}
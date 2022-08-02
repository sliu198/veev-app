import {useState, useCallback} from 'react';
import * as classes from './DeviceControl.module.css'
import {createPortal} from "react-dom";

export default function DeviceControl(
  {
    device: {id, name, state: {powerState, brightness, onBrightness}},
    togglePower,
    changeBrightness,
    disabled,
    className,
    ...restProps
  }) {
  className = [classes.DeviceControl, className].join(' ');
  const isOn = powerState === 'true';
  const brightnessValue = Number(isOn ? brightness : onBrightness);
  const brightnessDisplay = `${brightnessValue}%`
  const ariaLabel=[name, isOn ? 'on' : 'off', brightnessDisplay].join(', ')
  const buttonClassName = [classes.DeviceControlButton, isOn ? classes.DeviceControlButtonOn : null].join(' ');

  const [newBrightnessValue, setNewBrightnessValue] = useState(null);

  const onTogglePower = useCallback(() => togglePower(id), [togglePower, id]);
  const onChangeBrightnessInput = useCallback((delta) => {
    setNewBrightnessValue(brightness => {
      return Math.min(Math.max(brightness + delta, 0),100);
    });
  }, [setNewBrightnessValue]);
  const onCommitBrightnessChange = useCallback(async () => {
    const brightness = newBrightnessValue
    setNewBrightnessValue(null);
    await changeBrightness(id, brightness);
  }, [id, newBrightnessValue, setNewBrightnessValue, changeBrightness])
  const onDisplayBrightnessInput = useCallback((event) => {
    event.preventDefault();
    setNewBrightnessValue(brightnessValue);
  }, [setNewBrightnessValue, brightnessValue]);
  const onMouseChangeBrightness = useCallback(event => {
    onChangeBrightnessInput(-event.movementY)
  }, [onChangeBrightnessInput]);

  return <label className={className} aria-label={ariaLabel} {...restProps}>
    <button
      className={buttonClassName}
      onClick={onTogglePower}
      onContextMenu={onDisplayBrightnessInput}
      disabled={disabled}
      style={{'--brightness': brightnessDisplay}}
    >
      {brightnessDisplay}
    </button>
    <div>{name}</div>

    {/*TODO: touch handlers for changing brightness*/}
    {newBrightnessValue != null && createPortal(<div
        onMouseUp={onCommitBrightnessChange}
        onMouseMove={onMouseChangeBrightness}
        onClick={() => setNewBrightnessValue(null)}
        className={classes.DeviceControlBrightnessModal}
        style={{'--newBrightnessValue': newBrightnessValue}}>
        <div className={classes.DeviceControlBrightnessModalBrightnessText}>{`${newBrightnessValue}%`}</div>
        <div className={classes.DeviceControlBrightnessModalDeviceName}>{name}</div>
      </div>,
      document.getElementById('app'))}
  </label>
}

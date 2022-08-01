import * as classes from './DeviceControl.module.css'

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
  const brightnessDisplay = `${ isOn ? brightness : onBrightness }%`
  const ariaLabel=[name, isOn ? 'on' : 'off', brightnessDisplay].join(', ')
  const brightnessClassNames = [classes.DeviceControlBrightness, isOn ? classes.DeviceControlBrightnessOn : null].join(' ');

  return <button
    className={className}
    onClick={() => togglePower(id)}
    aria-label={ariaLabel}
    disabled={disabled}
    {...restProps}
  >
    <div
      style={{width: brightnessDisplay}}
      className={brightnessClassNames}/>
    {`${name} (${brightnessDisplay})`}
  </button>
}
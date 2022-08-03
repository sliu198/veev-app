import {useState, useCallback, useRef, useEffect} from 'react';
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

  const [shouldShowBrightnessInput, setShouldShowBrightnessInput] = useState(false);

  const onTogglePower = useCallback(() => togglePower(id), [togglePower, id]);
  const showBrightnessInput = useCallback((event) => {
    event.preventDefault();
    setShouldShowBrightnessInput(true);
  }, [setShouldShowBrightnessInput]);
  const commitBrightnessChange = useCallback(async (value) => {
    setShouldShowBrightnessInput(false);
    await changeBrightness(id, value);
  }, [id, changeBrightness])

  return <label className={className} aria-label={ariaLabel} {...restProps}>
    <button
      className={buttonClassName}
      onClick={onTogglePower}
      onContextMenu={showBrightnessInput}
      disabled={disabled}
      style={{'--brightness': brightnessDisplay}}
    >
      {brightnessDisplay}
    </button>
    <div>{name}</div>

    {/*TODO: touch handlers for changing brightness*/}
    {shouldShowBrightnessInput && createPortal(
      <BrightnessInput name={name} initialValue={brightnessValue} onChange={commitBrightnessChange}/>,
      document.getElementById('app'))}
  </label>
}

function BrightnessInput({name, initialValue, onChange}) {
  const [value, setValue] = useState(initialValue);

  const onChangeBrightness = useCallback(delta => {
    setValue(value => Math.min(Math.max(value + delta, 0), 100));
  }, [setValue])

  const onMouseMove = useCallback(event => {
    onChangeBrightness(-event.movementY)
  }, [onChangeBrightness]);

  const commitChange = useCallback(() => {
    onChange(value);
  }, [onChange, value])

  const [activeTouchId, setActiveTouchId] = useState(null);
  const [, setLastY] = useState(null);

  const onTouchStart = useCallback((event) => {
    event.preventDefault();

    setActiveTouchId(activeTouchId => {
      if (activeTouchId) return activeTouchId

      const startedTouch = event.changedTouches[0];
      setLastY(startedTouch.clientY)
      return startedTouch.identifier;
    });
  }, [setActiveTouchId])
  const onTouchMove = useCallback((event) => {
    event.preventDefault();

    const currentTouch = findTouchInList(activeTouchId, event.targetTouches);
    if (!currentTouch) return;
    setLastY(lastY => {
      const nextY = currentTouch.clientY;
      onChangeBrightness(lastY - nextY);
      return nextY;
    })
  }, [activeTouchId, setLastY]);
  const onTouchEnd = useCallback((event) => {
    event.preventDefault();

    if (activeTouchId == null) return;
    const currentTouch = findTouchInList(activeTouchId, event.targetTouches);
    if (currentTouch) return;

    setActiveTouchId(null);
    commitChange();
  }, [activeTouchId, setActiveTouchId, commitChange]);
  const onTouchCancel = useCallback(event => {
    if (activeTouchId == null) return;
    const currentTouch = findTouchInList(activeTouchId, event.targetTouches);
    if (currentTouch) return;

    setActiveTouchId(null);
    setValue(initialValue);
  }, [activeTouchId, setActiveTouchId, setValue]);

  const ref = useRef(null);
  useEffect(() => {
    const {current} = ref;
    if (!current) return;

    current.addEventListener('touchstart', onTouchStart, {passive: false});
    current.addEventListener('touchmove', onTouchMove, {passive: false});
    current.addEventListener('touchend', onTouchEnd, {passive: false});

    return () => {
      current.removeEventListener('touchmove', onTouchStart);
      current.removeEventListener('touchstart', onTouchMove);
      current.removeEventListener('touchend', onTouchEnd);
    }
  }, [ref, onTouchStart, onTouchMove, onTouchEnd]);

  return <div
    ref={ref}
    onMouseUp={commitChange}
    onMouseMove={onMouseMove}
    onTouchCancel={onTouchCancel}
    className={classes.DeviceControlBrightnessModal}
    style={{'--newBrightnessValue': value}}>
    <div className={classes.DeviceControlBrightnessModalBrightnessText}>{`${value}%`}</div>
    <div className={classes.DeviceControlBrightnessModalDeviceName}>{name}</div>
  </div>
}

function findTouchInList(id, touchList) {
  if (id == null) return null;

  for (let i = 0; i < touchList.length; i++) {
    const current = touchList.item(i);

    if (current.identifier === id) return current;
  }
}

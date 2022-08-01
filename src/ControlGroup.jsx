import * as classes from './ControlGroup.module.css'

export default function ControlGroup({children, className, ...containerProps}) {
  const [header, items] = children

  className = [classes.ControlGroupContainer, className].join(' ')

  return <div className={className} {...containerProps}>
    {header}
    <ul className={classes.ControlGroupList}>
      {
        items.map(item => <li key={item.key} className={classes.ControlGroupListItem}>
          {item}
        </li>)
      }
    </ul>
  </div>
}
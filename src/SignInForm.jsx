import {useCallback} from "react";

export default function SignInForm({onSubmit}) {
  const onSubmitHandler = useCallback((event) => {
    event.preventDefault();
    const {email: {value: email}, password: {value: password}} = event.target.elements
    onSubmit(email, password);
  }, [onSubmit]);

  return <form onSubmit={onSubmitHandler} name={'login-form'}>
    <input type={"email"} placeholder={"Email"} name={'email'} />
    <input type={"password"} placeholder={"Password"} name={'password'} />
    <input type={"submit"} value={"Sign In"}/>
  </form>;
}
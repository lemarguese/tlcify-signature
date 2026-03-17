import './Header.scss';

export default function Header () {
  return <header className='header'>
    <label className='header_label'>TLCify.com</label>
    <div className='header_right'>
      <p className='header_right_item'>My Policy</p>
      <p className='header_right_item'>About Us</p>
      <p className='header_right_item'>Contact Us</p>
    </div>
  </header>
}

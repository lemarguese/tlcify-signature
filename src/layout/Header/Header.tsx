import './Header.scss';
import { useState } from 'react';

export default function Header () {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className='header'>
      <label className='header_label'>TLCify.com</label>

      <div className='header_right'>
        <p className='header_right_item'>My Policy</p>
        <p className='header_right_item'>About Us</p>
        <p className='header_right_item'>Contact Us</p>
      </div>

      <button className='header_burger' onClick={() => setMenuOpen(v => !v)}>
        <span className={`header_burger_line ${menuOpen ? 'header_burger_line--open' : ''}`}/>
        <span className={`header_burger_line ${menuOpen ? 'header_burger_line--open' : ''}`}/>
        <span className={`header_burger_line ${menuOpen ? 'header_burger_line--open' : ''}`}/>
      </button>

      {menuOpen && (
        <div className='header_menu'>
          <p className='header_menu_item' onClick={() => setMenuOpen(false)}>My Policy</p>
          <p className='header_menu_item' onClick={() => setMenuOpen(false)}>About Us</p>
          <p className='header_menu_item' onClick={() => setMenuOpen(false)}>Contact Us</p>
        </div>
      )}
    </header>
  );
}

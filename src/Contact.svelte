<script>
  import { scale, draw, fade } from 'svelte/transition';
  import { elasticOut, quintOut } from 'svelte/easing';
  import { onMount } from 'svelte';

  export let elementPos;
  export let scrollPos;
  export let windowHeight;

</script>

<style>
  .main {
    width: 100%;
    min-height: 100%;
    display: flex;
    justify-content: center;
    background-image: url('./images/background.svg');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: left bottom;
  }

  .wrapper {
    display: grid;
    height: 100%;
    width: 70%;
    grid-template-columns: minmax(85%, 1fr) 1fr ;
  }

  .contactMeContainer {
    display: flex;
    align-items: center;
  }

  .contact {
    z-index: 2;
    opacity: .5;
    width: calc(8vmin + 8*(100vw - 400px)/ 400);
  }

  .form-container {
    display: flex;
    justify-content: center;
    height: 100%;
  }

  form {
     width: 90%;
   }

  .dn {
    display: none;
  }

  .form-input {
    color:white;
    font-family: 'Oswald', sans-serif;
    font-weight:500;
    font-size: 18px;
    border-radius: 5px;
    line-height: 22px;
    background-color: transparent;
    border:2px solid rgb(90, 12, 26);
    transition: all 0.3s;
    padding: 13px;
    margin-bottom: 15px;
    width:100%;
    box-sizing: border-box;
    outline:0;
  }

  .form-input:focus { 
    border:2px solid rgba(224, 30, 66, 0.454); 
  }

  textarea {
    height: 150px;
    line-height: 150%;
    resize:vertical;
  }

  [type="submit"] {
    font-family: 'Oswald', sans-serif;
    width: 100%;
    background:rgba(224, 30, 66, 0.454);
    border-radius:5px;
    border:0;
    cursor:pointer;
    color:white;
    font-size:24px;
    padding-top:10px;
    padding-bottom:10px;
    transition: all 0.3s;
    margin-top:-4px;
    font-weight:100;
    -webkit-appearance: none;
  }

  [type="submit"]:hover { 
    transform: scale(1.05)
  }

  @media only screen and (max-width: 700px) {
  .wrapper {
    width: 100%;
  }
  .contact {
    width: calc(12vmin + 8*(100vw - 400px)/ 400);
  }
}
</style>
   

<div class="main" {windowHeight} {scrollPos} {elementPos}>
  <div class="wrapper">
    <div id="form" class="form-container">
    {#if (scrollPos + (windowHeight * .5)) > elementPos }
      <form action="https://formspree.io/wsmartin23@gmail.com" method="POST">      
        <p class="dn">
          <label>Don’t fill this out if you're human: <input name="bot-field" /></label>
        </p>
        <input transition:scale="{{duration: 800, delay: 0, opacity: 0, start: .8, easing:elasticOut}}" name="name" type="text" class="form-input" placeholder="Your Name" />   
        <input transition:scale="{{duration: 800, delay: 50, opacity: 0, start: .8, easing:elasticOut}}" name="email" type="text" class="form-input" placeholder="Your Email" />
        <textarea transition:scale="{{duration: 800, delay: 100, opacity: 0, start: .8, easing:elasticOut}}" name="text" class="form-input" placeholder="Your Message here..."></textarea>
        <input transition:scale="{{duration: 800, delay: 150, opacity: 0, start: .8, easing:elasticOut}}" type="submit" value="SUBMIT"/>
      </form> 
    {/if}
    </div>
    {#if (scrollPos + (windowHeight * .5)) > elementPos }    
    <div class="contactMeContainer">
    <svg out:fade="{{delay: 0, duration: 300}}" class="contact" viewBox="0 0 164 844" fill="none" stroke="#E01E41" xmlns="http://www.w3.org/2000/svg">
      <path in:draw="{{duration: 2000, delay: 1000, easing: quintOut}}" d="M2 96L162 96L162 166L2 166L76.4304 130.741L2 96Z" stroke-width="4"/>
      <path in:draw="{{duration: 2000, delay: 1000, easing: quintOut}}" d="M162 5V75L82 75M82 75H2L2 5L82 75ZM82 75V5" stroke-width="4"/>
      <path in:draw="{{duration: 2000, delay: 1000, easing: quintOut}}" d="M150.409 744.827C135.412 752.546 37.2521 753.553 16.3474 744.827C-4.55725 736.101 -0.921503 692.807 16.3474 686.43C33.6163 680.053 134.504 678.375 150.409 686.43C166.315 694.485 165.406 737.108 150.409 744.827Z" stroke-width="4"/>
      <path in:draw="{{duration: 2000, delay: 1000, easing: quintOut}}" d="M150.149 772C166.411 780.701 165.482 826.742 150.149 835.08C134.816 843.418 25.1964 845.155 13.0839 835.08C0.971438 825.005 -4.14142 793.68 13.0839 772" stroke-width="4"/>
      <path in:draw="{{duration: 2000, delay: 1000, easing: quintOut}}" d="M150.149 338C166.411 346.701 165.482 392.742 150.149 401.08C134.816 409.418 25.1964 411.155 13.0839 401.08C0.971438 391.005 -4.14142 359.68 13.0839 338" stroke-width="4"/>
      <path in:draw="{{duration: 2000, delay: 1000, easing: quintOut}}" d="M162 590L2 660H162V590ZM162 590H2" stroke-width="4"/>
      <path in:draw="{{duration: 2000, delay: 1000, easing: quintOut}}" d="M162 534H2M2 534L2 569M2 534L2 499" stroke-width="4"/>
      <path in:draw="{{duration: 2000, delay: 1000, easing: quintOut}}" d="M162 282H2M2 282L2 317M2 282L2 247" stroke-width="4"/>
      <path in:draw="{{duration: 2000, delay: 1000, easing: quintOut}}" d="M162 499L2 465.75L162 429V499Z" stroke-width="4"/>
    </svg>
    </div>
    {/if}
  </div>
</div>

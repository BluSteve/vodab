## How to use

`!` Prefix for all commands

### Commands

`r` Toggle reading mode

`cd <deck name>` Change deck

`ps` Print settings

`cs <new settings in json format>` Change settings
<br/><br/>

`lw` List word

`downw` Download words in Anki format
<br/><br/>

`d[eb]?l?i? <word>` Define word

`wf?[eb]?l? <word>` Add word to deck

`mwf? <word | definition>` Add word with manual definition to deck

`delw <word>` Delete word

### Modifiers

`e` Use extended definition engines

`b` Use basic definition engines

`f` Force add a word, overriding existing word in deck

`l` "I'm feeling lucky" - add first definition and translation for word without manual selection

`i` Replies with a rendered HTML image, otherwise a formatted string

### Word format

`word [(part of speech)] :: [manual sentence example],, [next word]`

E.g.,

`!w bread (noun) :: I love bread,, sandwich`

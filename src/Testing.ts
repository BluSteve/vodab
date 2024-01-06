async function main() {
    const axios = require('axios').default;
    await axios.post('http://127.0.0.1:8765', {'action': 'sync', 'version': 6})
    // const raw = 'train';
    //
    // const fdapi = FreeDictionaryAPI.getInstance();
    // const gt = GoogleTranslate.getInstance(Language.en, Language.zh);
    // const wordnik = Wordnik.getInstance();
    // const linguee = Linguee.getInstance(Language.en, Language.fr);
    // const linguee2 = Linguee.getInstance(Language.en, Language.zh);
    //
    // let word = await Word.of(raw, [
    //         [MerriamWebster.getInstance(), WordInfo.meaning - WordInfo.ipa]],
    //     'noun');
    // // let a = word.finalized(0, undefined);
    // printAll(word);
    //
    // const card = {'Front': 'abc', 'Back': 'def'};
    // const card1 = {'Front': 'abc', 'Back': 'imposter'};
    // const card2 = {'Front': 'abcasdf', 'Back': 'def'};
    // const cards = [card, card2];
    // await anki.add(card);
    // console.log(await anki.listFront());
    // await anki.addAll([card]);
    // await anki.addAll(cards);

    // const actualCard: Card = toCard(a, Target.Anki);
    // console.log(actualCard)
    // const anki = await Anki.getInstance('asdf');
    // await anki.update(actualCard);

}

main().then();

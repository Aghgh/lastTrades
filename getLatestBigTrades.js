async function main() {
  let betCount = 500;

  // bots, sports-bettors, etc.
  let ignoreUsers = ["FDWTsTHFytZz96xmcKzf7S5asYL2", "qnIAzz9RamaodeiJSiGZO6xRGC63" // Yuna , Agh
    , "tRZZ6ihugZQLXPf6aPRneGpWLmz1", "sTUV8ejuM2byukNZp7qKP2OKXMx2",  // manifoldLove, NFL Unofficial
    "Iiok8KHMCRfUiwtMq1tl5PeDbA73", "EJQOCF3MfLTFYbhiKncrNefQDBz1"]; // Lion, Chris Billingto
  // users where you are less likely to benefit from correcting their trades (e.g. good users, news-traders, bots)
  let lessInterestingUsers = ["ilJdhpLzZZSUgzueJOs2cbRnJn82", "SqOJYkeySMQjqP3UAypw6DxPx4Z2",// Botlab, Shump
    "BhNkw088bMNwIFF2Aq5Gg9NTPzz1", "BgCeVUcOzkexeJpSPRNomWQaQaD3", "xB6IgHFizCHEJwqZ3un3", // acc, SemioticRivalry, mattyB
    "JlVpsgzLsbOUT4pajswVMr0ZzmM2", "EJQOCF3MfLTFYbhiKncrNefQDBz1"]; // joshua, chrisjbillington
  let uninterestingMarkets = ["vKZUxybbx1OnaklIO5CN", // Who will be the Republican nominee for vice presiden
    "GPQrtguru1sg9kGPg3i4", //China housing/real estate crisis by Sep 2024
    "z82v2ijIbM8AFL7jSIvm", // PEPE stock
    "UQIVR5EPgi2JSmHoWB5C", "0oJucOh5KnlC6EM0oql2"]; // uefa-euro-cup-2024-tournament-prop

  let interestingBetTreshold = 1.8;

  // how significant or exploitable the bet is
  function rateBet(bet) {
    let rating = 0;
    rating += Math.log10(bet._movement * 2 + 0.1)
    rating += Math.log10(bet._absAmount / 10 + 0.1)
    if (uninterestingMarkets.includes(bet.contractId)) { rating -= 1.3; }
    if (lessInterestingUsers.includes(bet.userId)) { rating -= 0.5; }
    if (ignoreUsers.includes(bet.userId)) { rating -= 2; }
    if (bet._unroundeProb === 0.5) { rating -= 2; } // likely the very first bet on a new market
    if (bet.probAfter >= 98.8 || bet.probAfter <= 1.2) { rating -= .5; } // market probably decided already
    if (bet.probAfter > 98.5 || bet.probAfter < 1.5) { rating -= 1.5; } // market probably decided already
    if (bet._isSold && bet._absAmount > 100) { rating += 0.7; } // sells are more likely to be non-epistemic
    if (bet.isApi) { rating -= 0.1; } // bots are harder to exploit
    rating -= bet._ageInMinutes / 60;
    if (bet._ageInMinutes <= 2) { rating += 0.2 }
    if (bet.answerId) { rating -= 0.3; } // personal dislike for multi-choice markets.

    return rating;
  }

  function output(...text) {
    outputNode('pre', false, ...text)
  }
  function outputBold(...text) {
    outputNode('pre', true, ...text)
  }
  function outputLink(link, text) {
    outputNode('a', true, link, text)
  }

  function outputVerbose(...text) {
    //TODO
  }

  function outputNode(node, bold, ...t) {
    const text = t.join('  ');
    console.log(text)
    if (!globalThis.document?.querySelector('#output')) return;
    const newNode = document.createElement(node);
    if (node === 'a') {
      newNode.href = t[0];
      newNode.innerText = t[1];
    } else {
      newNode.innerText = text;
    }

    if (bold) {
      newNode.style.fontWeight = "bold"
    }
    document.querySelector('#output').appendChild(newNode)
  }

  function refresh() {
    document.querySelector('#output').innerHTML = "";
    main();
  }

  function collectStats(bets) {
    let stats = {
      "amount >=500:": bets.filter(x => (x._absAmount) >= 500).length,
      "amound < 50  ": bets.filter(x => (x._absAmount) < 50).length,
      "movement >=20": bets.filter(x => x._movement >= 20).length,
      "movement <= 1": bets.filter(x => x._movement <= 1).length,
      "firstBet     ": bets.filter(x => x._unroundeProb === 0.5).length,
      "isApi        ": bets.filter(x => x.isApi).length,
      "isSell       ": bets.filter(x => x._isSold).length,
      "isLimitOrder ": bets.filter(x => !x.isFilled).length,
      "decidingBet  ": bets.filter(x => x._probAfter > 98.5 || x._probAfter < 1.5).length,
      "lastMinute   ": bets.filter(x => x._ageInMinutes <= 1).length,
      ">=60minutes  ": bets.filter(x => x._ageInMinutes > 60).length,
      "meh Markets  ": bets.filter(x => uninterestingMarkets.includes(x.contractId)).length,
      "meh Users    ": bets.filter(x => lessInterestingUsers.includes(x.userId)).length,
      "ignoreUsers  ": bets.filter(x => ignoreUsers.includes(x.userId)).length,
      "multi-Market ": bets.filter(x => x.answerId).length,
      "mergedBet    ": bets.filter(x => x.mergeInfo).length,
    }

    for (let stat in stats) {
      stats[stat] = roundTo2(stats[stat] / bets.length)
    }

    stats.nrofbets = bets.length;
    console.log(JSON.stringify(stats, null, 2));
  }


  function betToString(b) {
    let bet = structuredClone(b);
    for (str of ["fees", "isAnte", "id", "loanAmount", "isCancelled", // "createdTime","visibility",
      //"isChallenge","isRedemption",
      "userAvatarUrl", "isApi", "fills"
    ]) {
      delete bet[str];
    }
    return JSON.stringify(bet, null, 2);
  }
  function roundTo2(num) { return Math.round(num * 100) / 100 }

  // merge consecutive bets regardless of user
  // not sure if this works correctly
  function mergeConsecutiveBets(bets) {
    let aggregatedBets = [];
    for (let i = 0; i < bets.length; i++) {
      let bet = bets[i];
      let mergableBet = aggregatedBets.find((b) => b.contractId == bet.contractId
        && b.answerId == bet.answerId
        && b.outcome == bet.outcome // math for calculating value of merged yes and no bets is too difficult.
        && Math.abs(b._probAfter - bet._probBefore) <= 0.02
      );
      if (mergableBet) {
        mergableBet.mergeInfo = "" + (mergableBet.mergeInfo || Math.round(mergableBet.amount)) +
          " merged with " + Math.round(bet.amount);
        if (mergableBet._absAmount < bet._absAmount) {
          mergableBet.userName = mergableBet.userName || bet.userName
        }
        mergableBet._probAfter = bet._probAfter;
        mergableBet.probAfter = bet.probAfter;
        mergableBet.amount += bet.amount;
        mergableBet._absAmount = Math.abs(bet.amount);
      } else {
        aggregatedBets.push(bet)
      }
    }
    return aggregatedBets;
  }

  globalThis.marketCache = globalThis.marketCache || {}
  async function outputBetAndMarketInfo(bet) {
    let id = bet.contractId
    let market;
    if (marketCache[id]) {
      market = marketCache[id]; // save on API-Calls
    } else {
      let response2 = await fetch("https://api.manifold.markets/v0/market/" + id, { method: "GET" })
      market = await response2.json();
      marketCache[id] = market;
    }

    let realcurrentProb = market.probability && roundTo2(market.probability * 100);
    if (bet.answerId) {
      realcurrentProb = roundTo2(market.answers?.find(a => a.id === bet.answerId)?.probability * 100)
    }
    let answer = bet.answerId ? (market.answers?.find(a => a.id == bet.answerId)?.text) : bet.outcome
    outputLink(market.url, market.question + " (" + answer + ") " + market.uniqueBettorCount)

    if (market.isResolved) {
      outputBold("TOO LATE! market resolved!")
      output(" ");
      return;
    }
    if (realcurrentProb && Math.abs(realcurrentProb - bet._probAfter) > 0.9
      && /*bugfix because sometimes you get the old cached probability*/ realcurrentProb !== bet.probBefore) {
      outputBold("market moved more afterwards, current percentage:",
        realcurrentProb)//, " (_movement:",roundTo2(Math.abs(realcurrentProb-bet.probBefore)),")")
    }
    if (market.uniqueBettorCount <= 10) {
      outputBold(market.uniqueBettorCount <= 5 ? "VERY" : "", "new market!")
    }

    output("amount: ", Math.round(bet._absAmount) + (bet._isSold ? "(sell)" : ""),
      " significance:", roundTo2(bet._significance),)
    output("prob:   ", (bet._probBefore), " -> ", (bet._probAfter),
      (bet._ageInMinutes <= 1) ? "" : (" [placed " + bet._ageInMinutes + " minutes ago]"))
    console.log("user: ", bet.userName || bet.userUsername || bet.userId)

    console.log(bet.contractId);
    output(" ");
  }

  // START
  let response = await fetch("https://api.manifold.markets/v0/bets?order=desc&limit=" + betCount, { method: "GET" })
  let bets = await response.json();
  output("oldest   Bet:", new Date(bets[bets.length - 1].createdTime).toLocaleTimeString())
  output("youngest Bet:", new Date(bets[0].createdTime).toLocaleTimeString())

  for (let bet of bets) {
    // precalc some stuff 
    bet._isSold = bet.amount < 0;
    bet._unroundeProb = bet.probBefore
    bet._ageInMinutes = Math.floor((new Date() - bet.createdTime) / 1000 / 60)
    bet._absAmount = Math.abs(bet.amount)
    bet._probAfter = roundTo2(bet.probAfter * 100);
    bet._probBefore = roundTo2(bet.probBefore * 100);
    bet._movement = Math.abs(roundTo2((bet._probAfter - bet._probBefore) * 100))

  }
  collectStats(bets);

  bets = bets.filter(bet => bet._absAmount !== 0);
  console.log("filtered out " + (betCount - bets.length) + " nothing bets")
  let newCount = bets.length
  //let bets2 = mergeConsecutiveBets(bets);
  //output("bets merged "+(newCount - bets2.length));
  bets = mergeConsecutiveBets(bets.reverse());
  console.log("bets merged " + (newCount - bets.length));


  for (let bet of bets) {
    bet._movement = Math.abs(roundTo2((bet._probAfter - bet._probBefore) * 100))
    bet._probAfter = roundTo2(bet.probAfter * 100);
    bet._absAmount = Math.abs(bet.amount)
    bet._significance = rateBet(bet);
  }


  bets = bets.sort((a, b) => b._significance - a._significance);

  let mostSignificantBet = bets[0]; // biggest bet by _significance

  bets = bets.filter(bt => bt._significance > interestingBetTreshold)

  collectStats(bets);

  let topX = (betCount > 100 || bets.length >= 6) ? 5 : 3
  if ((betCount == 1000 && bets.length >= 10) || bets.length >= 15) { topX = 8 };

  output("noteworthy bets count:", bets.length, "(out of " + betCount + " total)")
  if (bets.length == 0) {
    output(betToString(mostSignificantBet));
    outputBold("only boring bets! most significant bet:")
    bets = [mostSignificantBet]
  } else {
    output("TOP " + topX + " bets:")
  }

  bets = bets.slice(0, topX);//.reverse();
  for (let bet of bets) {
    await outputBetAndMarketInfo(bet);
    //if (bet.mergeInfo){ outputBold(bet.mergeInfo)}
  }
  //output(JSON.stringify(mostSignificantBet,null,2))
}
//setTimeout(()=>{
globalThis.document?.getElementById("btn")?.addEventListener("click", () => { main() });
setTimeout(() => main())
//})
//main();
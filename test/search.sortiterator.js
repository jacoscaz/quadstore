
const SortIterator = require('../lib/search/generic-iterators/sort-iterator');
const utils = require('./utils');
const should = require('should');
const AsyncIterator = require('asynciterator');

module.exports = () => {

  describe('SortIterator', () => {

    it('should sort correctly', (cb) => {

      const u = [89419,29445,76449,84447,65207,54651,51727,82562,23353,16227,68752,74841,24463,81362,33473,25102,98011,11650,35200,21240,22394,5512,92696,30767,86557,34874,68911,60249,34525,22485,96263,77290,47235,48565,24528,18689,78824,38578,40618,16295,25135,80999,78670,42388,42364,76792,62242,2600,25086,15016,32418,15639,51263,57411,7290,65192,89054,6044,38187,869,73745,8760,28053,95476,98742,50108,98342,41313,94518,76260,30570,76551,2186,23044,24329,39386,80902,66546,52058,56465,77806,32196,85159,87217,83930,42244,22313,17249,54712,86822,91720,44628,76875,93695,37829,83354,97568,16628,95468,19956,93787,29590,81635,72472,58417,13674,87620,97023,9253,42798,4862,19491,96288,39920,20419,86747,35022,16259,81964,69114,77166,92928,91440,69563,51047,39016,60474,69236,14384,78514,32004,71251,30859,95033,27800,3410,35284,13851,966,73017,81896,98644,33889,24988,69363,49116,62444,41181,3950,77960,36732,51722,22466,75984,20777,87412,65620,43593,95237,57135,23667,732,50277,40778,74715,72894,58500,49312,16076,75828,87064,30170,78613,84295,18418,61480,51858,87911,79857,85591,57344,18037,75667,91775,4566,39900,96255,81097,65403,52051,63747,62457,81464,89047,99464,68598,26301,29283,3711,43264,4377,53340,66977,83293,37101,41406,80381,79553,95281,1515,76826,5018,5313,92183,87669,6417,77553,38704,66292,39335,95488,77531,37500,2407,48492,74484,81173,31189,80502,31904,90529,24875,14015,8747,78818,46192,51584,36442,96335,74697,95603,38178,91424,60051,82528,92934,71057,6504,10665,779,61624,51046,34548,89676,93928,27046,57314,74303,86122,88989,63563,90046,99529,86873,34305,716,64405,19398,73878,22833,98036,47467,93782,33556,59621,17909,41559,89114,86985,86061,88707,63504,29295,62858,93889,47447,81959,2489,86274,64505,71412,51620,53072,48971,87932,68066,76850,45201,9476,93282,93000,6111,32168,93174,57830,85735,5698,75720,54967,67380,46609,90797,11480,73584,66649,91682,63635,62446,49133,70796,32597,95122,8833,29473,74878,4956,26757,90044,4561,14230,72738,3249,63401,74596,82705,60643,98760,10826,24305,22262,23948,7276,71050,99132,30351,1484,45765,17589,36381,24955,1952,48877,58656,1424,99190,64797,64609,64204,85677,65057,50008,71013,77360,93624,88169,73920,68953,95681,85618,52420,18420,40448,65601,73422,14832,34601,40947,61597,12501,45571,67660,82734,73693,59745,41261,50438,81670,36039,88770,20219,57728,35618,98194,66898,18874,13665,75317,95868,32332,95986,68250,31913,70305,1797,88087,47157,96828,78695,24814,82069,50103,61709,78336,94183,58797,56270,73426,74650,50961,58278,96331,74264,19160,77646,61246,31684,54597,13711,27404,18194,23926,92973,56593,81998,24597,59855,2959,75492,75274,56945,23151,2201,45180,69278,59956,23790,59325,61224,67008,73846,72225,56870,6846,69631,10628,56827,18245,8077,61396,67222,59369,64194,44812,26422,3280,37826,11421,82357,40725,58284,16161,18326,3453,48573,75534,4006,50051,53555,42540,99871,49444,87667,83312,40911,34126,41127,83706,68910,71232,39036,97520,61867,69947,51784,72060,57052,65682,9840,51153,95335,44355,51616,38329,39001,90418,67424,39489,62738,6170,20394,62332,97717,35518,71568,17238,62398,81122,46128,66385,31785,71550,55033,35221,76754,54671,55256,25940,50544,47668,93859,94408,78244,44857,13967,18787,61191,46999,15434,43980,76129,87481,40088,89068,66302,13595,68530,26983,14860,78559,28208,66390,12294,22624,43999,17820,43850,76820,58850,92186,27937,79539,50444,57738,90527,36552,86740,30022,94600,55538,29772,78609,81310,80499,12241,36880,42358,78906,25532,54302,28197,23242,1871,25344,61528,8876,3962,85586,65283,41499,35070,19664,35277,29931,22708,14259,6278,54032,5381,46,19864,96533,70102,63135,67849,43854,34412,19060,39922,98074,37762,56187,59358,63821,60545,54223,1828,14564,39613,8171,1377,71928,13392,46458,55023,79801,59337,97767,34978,68156,72830,36406,35097,28506,42873,64677,11173,35143,84267,7129,73902,64773,29736,43711,93751,23408,74173,45373,76149,67012,66954,31959,58107,84741,54290,29903,25753,16435,15971,73228,5549,34877,88856,68627,97984,88040,49037,24319,47610,71964,75026,78585,93333,53509,6553,56735,16511,8391,34899,51326,32079,35525,97463,284,70637,32475,87729,63836,19475,63652,71470,22138,9327,55733,89938,772,30126,52392,47717,32232,67918,58188,12130,52207,78084,21827,44121,52872,75847,96773,47488,85687,90211,47701,87372,62371,3565,20873,80141,15528,85356,79032,45133,92797,46303,17316,9794,68857,89757,17055,33481,12260,71204,41044,70819,91382,3055,73340,57473,66177,76418,94306,65300,989,92894,39256,45231,21690,15752,97510,97033,27748,64438,56846,63737,44637,10370,46927,74911,57359,72632,91886,52449,12674,30171,93802,89610,53989,75744,10293,58132,43015,23673,65066,86268,99375,11426,23653,17574,53281,2942,41375,13889,60068,98956,75917,80363,29711,71638,62506,57660,42705,52345,89220,75873,29972,27431,11656,97975,19453,70684,71070,55153,52137,55842,22952,32991,71203,75627,39834,47398,53638,17554,49185,847,71365,78158,25396,1219,84108,14491,4797,64431,51279,48855,73644,48564,55097,91488,38672,16896,29577,42498,50125,10911,50663,13083,87346,89240,57867,92384,60719,28340,98281,59025,54755,1281,89417,75189,55790,76051,95384,4838,10679,24721,12360,24206,95420,13934,87496,37009,24164,11129,81865,4805,79018,40240,22064,20443,64643,41613,7144,86938,16569,79903,99971,56770,19800,28196,18807,42101,34910,64534,97082,73273,28657,37402,28901,22990,33750,58508,96025,57098,21022,81309,18172,62629,57950,78669,94675,39308,67645,7272,36807,25808,50354,24546,77563,56150,28251,91870,51257,8468,48803,8684,48005,72470,27755,29040,37998,17462,40398,71752,55028,15609,78225,5327,99580,13781,13767,9451,97809,11576,46358,55422,26778,8654,87521,78663,49685,74885,13051,55294,40993,24779,92351,50289,68277,85728,80030,8928,52733,56900,90795,26279,41187,22293,25297,60012,71820,13756,74056,44755,43324,79408,93034,93028,89962,57258,94222,90148,30364,70284,44330,14396,78262,24071,24737,29379,75101,22678,19305,14692,52412,77617,68024,48129,92461,65949,28641,66530,93778,8307,51206,6867];
      const s = [46,284,716,732,772,779,847,869,966,989,1219,1281,1377,1424,1484,1515,1797,1828,1871,1952,2186,2201,2407,2489,2600,2942,2959,3055,3249,3280,3410,3453,3565,3711,3950,3962,4006,4377,4561,4566,4797,4805,4838,4862,4956,5018,5313,5327,5381,5512,5549,5698,6044,6111,6170,6278,6417,6504,6553,6846,6867,7129,7144,7272,7276,7290,8077,8171,8307,8391,8468,8654,8684,8747,8760,8833,8876,8928,9253,9327,9451,9476,9794,9840,10293,10370,10628,10665,10679,10826,10911,11129,11173,11421,11426,11480,11576,11650,11656,12130,12241,12260,12294,12360,12501,12674,13051,13083,13392,13595,13665,13674,13711,13756,13767,13781,13851,13889,13934,13967,14015,14230,14259,14384,14396,14491,14564,14692,14832,14860,15016,15434,15528,15609,15639,15752,15971,16076,16161,16227,16259,16295,16435,16511,16569,16628,16896,17055,17238,17249,17316,17462,17554,17574,17589,17820,17909,18037,18172,18194,18245,18326,18418,18420,18689,18787,18807,18874,19060,19160,19305,19398,19453,19475,19491,19664,19800,19864,19956,20219,20394,20419,20443,20777,20873,21022,21240,21690,21827,22064,22138,22262,22293,22313,22394,22466,22485,22624,22678,22708,22833,22952,22990,23044,23151,23242,23353,23408,23653,23667,23673,23790,23926,23948,24071,24164,24206,24305,24319,24329,24463,24528,24546,24597,24721,24737,24779,24814,24875,24955,24988,25086,25102,25135,25297,25344,25396,25532,25753,25808,25940,26279,26301,26422,26757,26778,26983,27046,27404,27431,27748,27755,27800,27937,28053,28196,28197,28208,28251,28340,28506,28641,28657,28901,29040,29283,29295,29379,29445,29473,29577,29590,29711,29736,29772,29903,29931,29972,30022,30126,30170,30171,30351,30364,30570,30767,30859,31189,31684,31785,31904,31913,31959,32004,32079,32168,32196,32232,32332,32418,32475,32597,32991,33473,33481,33556,33750,33889,34126,34305,34412,34525,34548,34601,34874,34877,34899,34910,34978,35022,35070,35097,35143,35200,35221,35277,35284,35518,35525,35618,36039,36381,36406,36442,36552,36732,36807,36880,37009,37101,37402,37500,37762,37826,37829,37998,38178,38187,38329,38578,38672,38704,39001,39016,39036,39256,39308,39335,39386,39489,39613,39834,39900,39920,39922,40088,40240,40398,40448,40618,40725,40778,40911,40947,40993,41044,41127,41181,41187,41261,41313,41375,41406,41499,41559,41613,42101,42244,42358,42364,42388,42498,42540,42705,42798,42873,43015,43264,43324,43593,43711,43850,43854,43980,43999,44121,44330,44355,44628,44637,44755,44812,44857,45133,45180,45201,45231,45373,45571,45765,46128,46192,46303,46358,46458,46609,46927,46999,47157,47235,47398,47447,47467,47488,47610,47668,47701,47717,48005,48129,48492,48564,48565,48573,48803,48855,48877,48971,49037,49116,49133,49185,49312,49444,49685,50008,50051,50103,50108,50125,50277,50289,50354,50438,50444,50544,50663,50961,51046,51047,51153,51206,51257,51263,51279,51326,51584,51616,51620,51722,51727,51784,51858,52051,52058,52137,52207,52345,52392,52412,52420,52449,52733,52872,53072,53281,53340,53509,53555,53638,53989,54032,54223,54290,54302,54597,54651,54671,54712,54755,54967,55023,55028,55033,55097,55153,55256,55294,55422,55538,55733,55790,55842,56150,56187,56270,56465,56593,56735,56770,56827,56846,56870,56900,56945,57052,57098,57135,57258,57314,57344,57359,57411,57473,57660,57728,57738,57830,57867,57950,58107,58132,58188,58278,58284,58417,58500,58508,58656,58797,58850,59025,59325,59337,59358,59369,59621,59745,59855,59956,60012,60051,60068,60249,60474,60545,60643,60719,61191,61224,61246,61396,61480,61528,61597,61624,61709,61867,62242,62332,62371,62398,62444,62446,62457,62506,62629,62738,62858,63135,63401,63504,63563,63635,63652,63737,63747,63821,63836,64194,64204,64405,64431,64438,64505,64534,64609,64643,64677,64773,64797,65057,65066,65192,65207,65283,65300,65403,65601,65620,65682,65949,66177,66292,66302,66385,66390,66530,66546,66649,66898,66954,66977,67008,67012,67222,67380,67424,67645,67660,67849,67918,68024,68066,68156,68250,68277,68530,68598,68627,68752,68857,68910,68911,68953,69114,69236,69278,69363,69563,69631,69947,70102,70284,70305,70637,70684,70796,70819,71013,71050,71057,71070,71203,71204,71232,71251,71365,71412,71470,71550,71568,71638,71752,71820,71928,71964,72060,72225,72470,72472,72632,72738,72830,72894,73017,73228,73273,73340,73422,73426,73584,73644,73693,73745,73846,73878,73902,73920,74056,74173,74264,74303,74484,74596,74650,74697,74715,74841,74878,74885,74911,75026,75101,75189,75274,75317,75492,75534,75627,75667,75720,75744,75828,75847,75873,75917,75984,76051,76129,76149,76260,76418,76449,76551,76754,76792,76820,76826,76850,76875,77166,77290,77360,77531,77553,77563,77617,77646,77806,77960,78084,78158,78225,78244,78262,78336,78514,78559,78585,78609,78613,78663,78669,78670,78695,78818,78824,78906,79018,79032,79408,79539,79553,79801,79857,79903,80030,80141,80363,80381,80499,80502,80902,80999,81097,81122,81173,81309,81310,81362,81464,81635,81670,81865,81896,81959,81964,81998,82069,82357,82528,82562,82705,82734,83293,83312,83354,83706,83930,84108,84267,84295,84447,84741,85159,85356,85586,85591,85618,85677,85687,85728,85735,86061,86122,86268,86274,86557,86740,86747,86822,86873,86938,86985,87064,87217,87346,87372,87412,87481,87496,87521,87620,87667,87669,87729,87911,87932,88040,88087,88169,88707,88770,88856,88989,89047,89054,89068,89114,89220,89240,89417,89419,89610,89676,89757,89938,89962,90044,90046,90148,90211,90418,90527,90529,90795,90797,91382,91424,91440,91488,91682,91720,91775,91870,91886,92183,92186,92351,92384,92461,92696,92797,92894,92928,92934,92973,93000,93028,93034,93174,93282,93333,93624,93695,93751,93778,93782,93787,93802,93859,93889,93928,94183,94222,94306,94408,94518,94600,94675,95033,95122,95237,95281,95335,95384,95420,95468,95476,95488,95603,95681,95868,95986,96025,96255,96263,96288,96331,96335,96533,96773,96828,97023,97033,97082,97463,97510,97520,97568,97717,97767,97809,97975,97984,98011,98036,98074,98194,98281,98342,98644,98742,98760,98956,99132,99190,99375,99464,99529,99580,99871,99971];
      const c = (a, b) => a < b ? -1 : (a === b ? 0 : 1);
      const ui = new AsyncIterator.ArrayIterator(u);
      const si = new SortIterator(ui, c);
      utils.iteratorToArray(si, (err, arr) => {
        should(arr).deepEqual(s);
        should(si.done).equal(true);
        cb();
      });

    });

  });

};

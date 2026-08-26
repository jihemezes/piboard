/* PiBoard - test/netConfig.test.js
   Filtrage des cartes virtuelles et parseurs des trois plateformes.
   Les parseurs sont PURS : cette suite passe donc sur n'importe quelle
   machine, y compris pour les plateformes qu'elle n'execute pas.
   Virtual adapter filtering and the three platforms' parsers. The parsers
   are PURE: this suite therefore passes on any machine, including for the
   platforms it is not running on. */
"use strict";
const net = require("../server/netConfig.js");
const platform = require("../server/platform");
let ok = 0;
function check(l, c) {
  if (!c) { console.error("  FAIL " + l); process.exitCode = 1; }
  else { console.log("  OK   " + l); ok++; }
}

console.log("== filtrage des cartes virtuelles ==");
const V4 = (ip, mac) => [{ family: "IPv4", address: ip, netmask: "255.255.255.0", mac, internal: false, cidr: ip + "/24" }];

let r = net._collectInterfaces({
  lo: [{ family: "IPv4", address: "127.0.0.1", netmask: "255.0.0.0", mac: "00:00:00:00:00:00", internal: true }],
  eth0: V4("192.168.1.10", "b8:27:eb:11:22:33"),
  wlan0: V4("192.168.1.11", "dc:a6:32:11:22:33"),
  docker0: V4("172.17.0.1", "02:42:ac:11:00:01"),
  "vEthernet (Default Switch)": V4("172.20.0.1", "00:15:5d:01:02:03"),
  vboxnet0: V4("192.168.56.1", "0a:00:27:00:00:00")
});
check("la boucle locale est ecartee", !r.some((i) => i.name === "lo"));
check("les vraies cartes sont conservees", r.length === 2);
check("Ethernet et WiFi sont presents", r.map((i) => i.name).join(",") === "eth0,wlan0");
// La MAC est le critere le plus solide : ces prefixes sont attribues aux
// editeurs d'hyperviseurs et ne peuvent pas apparaitre sur une vraie carte.
// The MAC is the strongest criterion: these prefixes belong to hypervisor
// vendors and cannot appear on a real card.
check("Docker est ecarte par son prefixe MAC", net._isVirtualMac("02:42:ac:11:00:01"));
check("Hyper-V est ecarte par son prefixe MAC", net._isVirtualMac("00:15:5d:01:02:03"));
check("VirtualBox est ecarte par son prefixe MAC", net._isVirtualMac("08:00:27:aa:bb:cc"));
check("une MAC Raspberry Pi n'est PAS prise pour virtuelle", !net._isVirtualMac("b8:27:eb:11:22:33"));
check("une MAC Intel n'est PAS prise pour virtuelle", !net._isVirtualMac("ac:12:03:4b:5d:6e"));

// Le nom est le critere le moins fiable : il ne doit surtout pas mordre
// sur des noms de vraies cartes.
// The name is the least reliable criterion: it must certainly not bite
// real adapter names.
check("le nom 'docker0' est reconnu virtuel", net._isVirtualName("docker0"));
check("le nom 'vEthernet (x)' est reconnu virtuel", net._isVirtualName("vEthernet (Default Switch)"));
check("le nom 'eth0' n'est PAS reconnu virtuel", !net._isVirtualName("eth0"));
check("le nom 'wlan0' n'est PAS reconnu virtuel", !net._isVirtualName("wlan0"));
check("le nom 'Ethernet' n'est PAS reconnu virtuel", !net._isVirtualName("Ethernet"));
check("le nom 'Wi-Fi' n'est PAS reconnu virtuel", !net._isVirtualName("Wi-Fi"));

// Une carte sans IPv4 n'est pas reellement connectee : c'est le critere
// demande, et il couvre aussi le cable debranche.
// An adapter with no IPv4 is not really connected: the requested
// criterion, which also covers an unplugged cable.
r = net._collectInterfaces({
  eth1: [{ family: "IPv6", address: "fe80::1", mac: "b8:27:eb:00:00:01", internal: false }]
});
check("une carte sans IPv4 est ecartee (non connectee)", r.length === 0);

// Node renvoie une entree PAR ADRESSE : sans regroupement la fenetre
// listerait trois fois la meme carte.
// Node returns one entry PER ADDRESS: without grouping the window would
// list the same adapter three times.
r = net._collectInterfaces({
  eth0: [
    { family: "IPv4", address: "192.168.1.10", netmask: "255.255.255.0", mac: "b8:27:eb:11:22:33", internal: false },
    { family: "IPv6", address: "fe80::1", mac: "b8:27:eb:11:22:33", internal: false },
    { family: "IPv6", address: "2001:db8::1", mac: "b8:27:eb:11:22:33", internal: false }
  ]
});
check("les adresses d'une meme carte sont regroupees", r.length === 1);
check("les adresses de lien local sont exclues des IPv6", r[0].ipv6.join() === "2001:db8::1");

console.log("== Windows : ipconfig /all (sortie francaise) ==");
const win = platform.implementations.win32();
const FR = [
  "Configuration IP de Windows", "",
  "   Suffixe DNS principal . . . . . . : maison.lan", "",
  "Carte reseau sans fil Wi-Fi :", "",
  "   Adresse physique . . . . . . . . . : AC-12-03-4B-5D-6E",
  "   DHCP active. . . . . . . . . . . . : Oui",
  "   Passerelle par defaut. . . . . . . : 192.168.1.1",
  "   Serveur DHCP . . . . . . . . . . . : 192.168.1.254",
  "   Expiration du bail . . . . . . . . : mardi 26 aout 2026 20:12:03",
  "   Serveurs DNS. . .  . . . . . . . . : 192.168.1.1",
  "                                        9.9.9.9", ""
].join("\r\n");
const w = win.parseIpconfig(FR);
check("le suffixe DNS principal est lu", w.domain === "maison.lan");
check("une carte est detectee", w.adapters.length === 1);
check("la passerelle est lue malgre la localisation", w.adapters[0].gateway === "192.168.1.1");
check("DHCP 'Oui' est compris", w.adapters[0].dhcp === true);
check("le serveur DHCP est distingue de la passerelle", w.adapters[0].dhcpServer === "192.168.1.254");
check("l'expiration du bail est lue", /26 aout 2026/.test(w.adapters[0].leaseExpires));
// Le second DNS est sur une ligne de continuation sans etiquette :
// l'ignorer perdrait la moitie de l'information.
// The second DNS sits on an unlabelled continuation line: ignoring it
// would lose half the information.
check("les DEUX serveurs DNS sont lus", w.adapters[0].dns.join(",") === "192.168.1.1,9.9.9.9");
check("le type WiFi est deduit du libelle", w.adapters[0].type === "wifi");
check("une sortie vide ne leve pas d'exception", win.parseIpconfig("").adapters.length === 0);
check("une sortie illisible ne leve pas d'exception", win.parseIpconfig("n'importe quoi").adapters.length === 0);

console.log("== Linux : ip route / resolvectl ==");
const lin = platform.implementations.linux();
const routes = lin.parseIpRoute("default via 192.168.1.1 dev wlan0 proto dhcp metric 600\n192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.42");
check("la passerelle par defaut est lue", routes.wlan0 === "192.168.1.1");
// Une route de sous-reseau n'a pas de passerelle : la retenir en
// inventerait une.
// A subnet route has no gateway: keeping it would invent one.
check("les routes de sous-reseau sont ignorees", Object.keys(routes).length === 1);
check("une table vide ne leve pas d'exception", Object.keys(lin.parseIpRoute("")).length === 0);

const rv = lin.parseResolvectl("Link 3 (wlan0)\n    Current DNS Server: 192.168.1.1\n         DNS Servers: 192.168.1.1 9.9.9.9\n          DNS Domain: maison.lan\n");
check("les DNS par lien sont lus", rv.wlan0.dns.includes("9.9.9.9"));
check("le domaine par lien est lu", rv.wlan0.domain === "maison.lan");

// 127.0.0.53 est le resolveur local de systemd, pas un vrai serveur.
// 127.0.0.53 is systemd's local stub, not a real server.
const rc = lin.parseResolvConf("nameserver 127.0.0.53\nnameserver 192.168.1.1\nsearch maison.lan\n");
check("le resolveur local systemd est ecarte", !rc.dns.includes("127.0.0.53"));
check("le vrai serveur est conserve", rc.dns.join() === "192.168.1.1");
check("le domaine de recherche est lu", rc.domain === "maison.lan");

console.log("== fusion socle + plateforme ==");
const base = [{ name: "wlan0", mac: "b8:27:eb:11:22:33", ipv4: "192.168.1.42", gateway: null, dns: [], dhcp: null }];
net._mergeDetails(base, { adapters: [{ name: "wlan0", gateway: "192.168.1.1", dhcp: true, dns: ["9.9.9.9"] }] });
check("l'enrichissement est fusionne par nom", base[0].gateway === "192.168.1.1");
const byMac = [{ name: "Wi-Fi", mac: "AC:12:03:4B:5D:6E", ipv4: "192.168.1.42", gateway: null, dns: [] }];
// Windows nomme les cartes differemment selon l'outil : la MAC est la
// seule cle reellement fiable.
// Windows names adapters differently depending on the tool: the MAC is
// the only genuinely reliable key.
net._mergeDetails(byMac, { adapters: [{ name: "autre nom", mac: "ac:12:03:4b:5d:6e", gateway: "192.168.1.1" }] });
check("la fusion retombe sur la MAC si le nom differe", byMac[0].gateway === "192.168.1.1");
check("un enrichissement absent laisse le socle intact",
  net._mergeDetails([{ name: "x", gateway: null }], null)[0].gateway === null);

console.log("== interface de la couche plateforme ==");
// La regle du projet : toute fonction de l'interface doit exister dans
// LES TROIS implementations, sinon un deploiement casse sur une seule
// plateforme.
// The project's rule: every interface function must exist in ALL THREE
// implementations, otherwise a deployment breaks on one platform only.
for (const id of ["linux", "win32", "darwin"]) {
  check("networkDetails existe pour " + id,
    typeof platform.implementations[id]().networkDetails === "function");
}

console.log("\n" + ok + " assertions OK");

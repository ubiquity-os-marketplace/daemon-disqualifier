# Changelog

## [1.1.0](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/compare/v1.0.3...v1.1.0) (2026-04-21)


### Features

* **cron:** run synthetic repo updates without comment edits ([78b560f](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/78b560f0c2fe37f80bf73e525a4599746e543bea))
* migrate issue state to postgres ([e0640a8](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/e0640a89368665cb1949422f3f2e415d0b774e11))
* run cron via repo octokit and remove commentId tracking ([c1143b0](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/c1143b0dfbb6de4265096406188205537c030908))


### Bug Fixes

* add json import attributes for deno ([c1e43d7](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/c1e43d75e458a9ba265f92ee16ae3eea8c01f076))
* address non-transitive CI failures ([eed4ca3](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/eed4ca35ba2a2f06b4e8fee37cf17e9a88a112ad))
* align deno runtime env handling ([6ab9133](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/6ab913327bf8bb2a53b825f2e5cf151acc3f5f7e))
* await handler before closing adapters ([96cf800](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/96cf80093b207343b4d19373a037b54e6e7fe0ef))
* bump plugin-sdk for runtime manifest refs ([04f777b](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/04f777b35c01d252308706566567d3d1535e65cc))
* cast runtime log level ([0e180f4](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/0e180f45db57a8dd5a7ba621e59d0c91a7694d14))
* **ci:** align deploy action target and manifest prepare ([33bca45](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/33bca45c9f7209165dfbd04085a6ac24d6e9ddb1))
* **ci:** setup deno before install-time manifest generation ([4ffda04](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/4ffda04e3704ce74e420683ca327fb8e194737f5))
* **ci:** treat demo as production secrets environment ([32fbe4b](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/32fbe4bb5bf262200afffe24cddd02b5b7162601))
* **ci:** use artifact branch deploy actions ([47ed477](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/47ed47713f2cb0b1a6e8cb206a616e76383cb366))
* correct deploy plugin entrypoint ([32abde7](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/32abde77c2f3515ba1193bf464c5f414a58e6263))
* **cron:** align synthetic event to issue_comment.edited ([06b77f5](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/06b77f5572c47049b0d963cdb6613c567d61c9ed))
* **cron:** resolve plugin manifests from dist branches ([f8fd1f0](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/f8fd1f0a871e81a2fb5e5788136a387e381e8c0d))
* **cron:** resolve plugin manifests from dist branches ([b8de72f](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/b8de72f151a01b781f6b9636d3354fb633c79103))
* generate manifest on install for tests and deploy ([0852d1b](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/0852d1bfc7f582eed867078918a5284fbfbfc91e))
* inline manifest prepare and target deploy action main ([b2b5b03](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/b2b5b030b56afe2d9cc3654b0fb01d38d97fe179))
* **knip:** use bunx for manifest prepare script ([957121e](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/957121e4b2f2a4f9a1272d25e2a80f19232a4bdd))
* **manifest:** derive short_name from CI repository context ([ab39dbb](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/ab39dbb7ffd0455d7353b8df03288600273bcc7d))
* pin manifest workflow to issue-27 deploy action ([9af36e3](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/9af36e3a294a04faa7c0cb2ce7bcf55080695b2e))
* **prepare:** use published manifest tool dist-tag ([cdd4a73](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/cdd4a7343a76ff632bd1ba2b42e40c5b4861821c))
* set deploy action ref to [@main](https://github.com/main) ([0f52b19](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/0f52b19abe4f5d324bf7c5236893984a63aced10))
* suppress postgres cspell false positive ([aab36a0](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/aab36a0dab17f5c33fd131709683d4ad2e79ed40))
* sync manifest workflow metadata for issue 27 ([0730658](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/073065864fda684b43fd20e48c888b900da2c042))
* sync workflow skipBotEvents and parameter metadata ([0c90a82](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/0c90a82577a74bc6bf43adeb69033c001c49c8fb))
* sync workflow skipBotEvents and parameter metadata ([d092b62](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/d092b62b2dbf995b17c01d89d9bf0ded9beb12c0))
* widen runtime env typing ([6596537](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/65965371196c5e35a7bab8bb285313e7abfb6199))
* **workflows:** pin deploy action ref and source branch input ([8d21980](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/8d219809e840abb44b6b398f46d8b700d9e84569))
* **workflows:** use artifact deploy action branch for dist publish ([f13f2d7](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/f13f2d78ee28ba443c0be24bfb41b22645fbde7c))

## 1.0.3 (2026-01-02)


### Bug Fixes

* accept kernelPublicKey input ([80e5556](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/80e55562fe695801046215fea6a8d5daa3b924d9))
* add project_name to Deno Deploy action configuration ([2bb3b7a](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/2bb3b7a5b228859721266d6896c3abefc6cc0de0))
* bump @ubiquity-os/plugin-sdk to 3.3.4 ([1639d41](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/1639d418e4721f3681fad1686f25837d81bad1de))
* bumped SDK ([367d477](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/367d4770cb69254137b27292d1012170b73c55ac))
* bumped SDK ([8eb00cc](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/8eb00cc25913fb77dc3172efb7f8472aec8d41da))
* clear assignees instead of removing them ([9954cb2](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/9954cb2a4639381a55eb5daa3307841f4b4d9dae))
* filter null or undefined labels in priority parsing ([8737727](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/87377271dc64b6f0edb2bdb89e1970f88b25c181))
* support `issues.reopened` event in activity watcher ([513bf5a](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/513bf5a45d88ce888a42c92dd1f52661f8f5ff06))
* support `issues.reopened` event in activity watcher ([0f4cfe6](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/0f4cfe6ec56a87d0c36a065a76d68b4429a02a5f))
* update cron state in activity watcher ([0220267](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/02202673333e16f374c2de43d11d72b345ddacde))


### Miscellaneous Chores

* release 1.0.3 ([091b2a1](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/091b2a1b8cc2ac05fc4de976ad920729447b9b07))

## [1.0.2](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/compare/v1.0.1...v1.0.2) (2025-07-25)


### Bug Fixes

* **workflow:** update environment condition for tags ([186e2cc](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/186e2cceaa304df7c32b711cbbfe077a1b5db115))

## [1.0.1](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/compare/v1.0.0...v1.0.1) (2025-07-11)


### Bug Fixes

* the package is now compiled as ESM ([a9ba41d](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/a9ba41d47044ff69254553eb1373f61ec4830496))

## 1.0.0 (2025-07-02)


### Bug Fixes

* release-please ([cab247a](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/cab247ad7bbfd45dee3884385bd76596f786678f))
* **release-please:** fixed the `release-please` workflow to properly run and tag ([729f533](https://github.com/ubiquity-os-marketplace/daemon-disqualifier/commit/729f533bee3beb476d355cf64bb7206d9ec34a4f))

## 1.0.0 (2024-07-09)

### Features

- added testing ([c834de9](https://github.com/ubiquibot/user-activity-watcher/commit/c834de9edefce23c11dc4d91ecc48d7e16ed3e5f))
- changed the time parsing to be with ms package ([99fa8f7](https://github.com/ubiquibot/user-activity-watcher/commit/99fa8f74524552b8dd17ae0dd6a66da3782abab3))
- database generation script ([6f19d4d](https://github.com/ubiquibot/user-activity-watcher/commit/6f19d4d0722dbcfd4e3b59ce1dddb94a550a20ac))
- database generation script ([fb4be18](https://github.com/ubiquibot/user-activity-watcher/commit/fb4be189de5c07794d05099acc9b61991f9813bf))
- linked pull request activity is now taken into account ([790d1c1](https://github.com/ubiquibot/user-activity-watcher/commit/790d1c12e3b1d716e72756e486723c3fe018d252))
- threshold can be expressed as human-readable strings ([df167d0](https://github.com/ubiquibot/user-activity-watcher/commit/df167d0b29335c1143ff6e1e6c2f11f0529e59c5))
- user get reminded and unassigned ([797cd6e](https://github.com/ubiquibot/user-activity-watcher/commit/797cd6e27788e119de27722118fbcf766ce4e79a))

### Bug Fixes

- moved get env outside of main file ([cb55e61](https://github.com/ubiquibot/user-activity-watcher/commit/cb55e610d5ec2d7dd936f97155f2cc1814c1302d))
- updated Jest test comment ([d6d5e28](https://github.com/ubiquibot/user-activity-watcher/commit/d6d5e2881a106568f1b2eb6ba9710041dba75950))

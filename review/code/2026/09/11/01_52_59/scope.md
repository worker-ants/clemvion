# 변경 범위(Scope) 리뷰 — `impl-chat-channel-patch-token` (6라운드, 전수, `01_52_59`)

## 검토 방법

`origin/main...HEAD` 전체 diff(145개 파일, 9개 커밋 `4a8b5f456`~`84a6aeaa8`)를 대상으로 했다.
이전 다섯 라운드(`review/code/2026/09/10/23_21_57`·`23_55_23`·`review/code/2026/09/11/00_21_55`·
`00_45_18`·`01_27_26`)의 scope 검토가 이미 핵심 코드(DTO·서비스·컨트롤러·e2e)를 D-1/D-2/D-3
세 항목에 좁게 대응함을 반복 확인하고 NONE 으로 수렴시켰으므로, 이번 라운드는 (a) 그 결론이
최신 소스에서도 유지되는지와 (b) 직전 라운드(`01_27_26`) **이후** 실제로 추가된 델타(마지막 커밋
`84a6aeaa8` — 테스트 6조합 추가 + `store`→`rotate` 용어 정정 3곳 + 트래커 갱신)에 스코프 이탈이
있는지에 집중했다. `git show <hash> -- <path>` 로 커밋 단위 diff 를 직접 열었고, 저장소 트리에
대한 뮤테이션은 하지 않았다(`git status --short` 확인 — 이 세션의 출력 디렉터리 외 잔여물 없음).

## 발견사항

없음.

## 확인한 것 — 6라운드 델타(`84a6aeaa8`)가 직전 WARNING 에 1:1 대응함

`c817a44c4`(CHANGELOG+트래커) 이후 `84a6aeaa8` 한 커밋만 코드에 손을 댔다. 내용은 직전 전수
라운드(`review/code/2026/09/11/01_27_26`)가 낸 WARNING 정확히 두 항목에 대응한다:

- **`triggers.service.spec.ts`**: 기존 `it.each` 4조합(신규 2필드 `botToken`/
  `inboundSigningPlaintext` × `null`/`''`)에 **내부 3필드**(`botTokenRef`·`inboundSigningRef`·
  `inboundSigning`) × `null`/`''` 6조합을 **같은 배열에 추가**했을 뿐이다 — 새 `describe`·새
  헬퍼·새 어서션 구조 없이 기존 테이블을 확장하는 최소 변경.
- **`slack.adapter.ts:65`·`triggers.service.ts:755`·`chat-channel-config.dto.ts:252`**: 주석 안의
  `SecretResolver.store` → `SecretResolver.rotate` (UPSERT) 문구 정정 3곳뿐 — 실행 코드 변경
  없음. 커밋 메시지가 이 세 자리를 "`store()` vs `rotate()` drift 열거가 `spec/` 만 grep 해서
  놓쳤던 `codebase/**` 자리" 로 명시했고, `git grep`으로 재확인해도 이 3곳 외 `codebase/**` 내
  `.store(` 잔여 호출부는 없다(전부 주석/JSDoc 텍스트 정정).
- **`plan/in-progress/spec-draft-nullable-notation-followups.md`**: 위 두 정정에 대응하는 트래커
  각주 갱신뿐 — 새 항목 신설이 아니라 기존 항목의 "재정정" 기록.

새 기능·새 API·새 config 옵션·무관한 리팩토링은 이 커밋에 없다.

## 스코프 밖 변경 없음 확인 (전체 diff)

- **import**: 이번 전체 diff 에서 신규 import 는 `@nestjs/swagger` 의 `OmitType` 1개
  (`chat-channel-config.dto.ts`)와 테스트 파일의 `ArgumentMetadata`/`BadRequestException`/
  `CustomValidationPipe` 뿐이며, 전부 실제로 신설 로직(`ChatChannelUpdateConfigDto`,
  전역 파이프 vs 서비스 가드 분기 테스트)에서 소비된다. 미사용 import 없음.
- **설정 파일**: `package.json`/`pnpm-lock.yaml`/`tsconfig*`/`eslint.config.mjs` 등 0건
  (`git diff origin/main...HEAD --name-only`에서 확인 — `config`/`.yml`/`lock` 문자열 매치는
  전부 `chat-channel-config.dto.ts`·`06-integrations-and-config/*.mdx` 파일명 우연 매치이고
  실제 설정 파일이 아니다).
- **spec/ 미접촉**: `spec/**` 파일 0건 — `details.field` placeholder 실측·`store()`/`rotate()`
  용어 drift 잔여 9곳(`spec/` 전용)은 코드로 우회하지 않고 `plan/in-progress/
  spec-draft-nullable-notation-followups.md` 에 planner 인계 항목으로만 남겨 developer/planner
  경계를 지켰다.
- **CHANGELOG.md**: 코드 변경(`08fbf133d`·`bfa124920`·`f5d97aa39`)이 같은 커밋에서 CHANGELOG 를
  갱신해 온 선례를 `c817a44c4` 커밋 메시지가 실측으로 확인하고 따른 것 — 무관한 수정이 아니다.
- **리뷰/일관성 산출물 커밋**: `review/code/**`·`review/consistency/**` 를 코드 수정과 같은
  브랜치에 커밋한 것은 CLAUDE.md 저장소 관례(코드 리뷰·일관성 검토 산출물 지정 경로 커밋)와
  이전 라운드들이 이미 일관되게 해 온 방식이라 스코프 위반이 아니다.
- **핵심 구현(DTO/서비스/컨트롤러/e2e 6~7개 파일)**: 이전 라운드들이 이미 상세 검증했고 이번
  라운드에서도 diff 형태가 유지됨을 재확인했다 — `ChatChannelUpdateConfigDto` 신설(D-1,
  `OmitType` 로 두 필드만 봉쇄), `storeUserSuppliedSecrets` 플래그를 통한 secret 쓰기 게이팅
  (D-2), `provider`/`chatChannel` 최초 부착 차단(D-3) 세 축 밖으로 벗어난 수정은 없다.

## 요약

이번 6라운드(전수)가 대상으로 하는 마지막 델타(`84a6aeaa8`)는 직전 전수 라운드가 낸 WARNING
두 건 — 내부 3필드 테스트 커버리지 공백, `store()`/`rotate()` 주석 용어 drift `codebase/**` 3곳
— 에 정확히 대응하는 최소 수정이며, 새 기능·무관한 리팩토링·설정 변경·미사용 import 는 없다.
전체 diff(145파일, `spec/` 0건, config/lock 0건) 를 다시 훑어도 이전 다섯 라운드의 NONE 판정을
뒤집을 근거는 없다.

## 위험도

NONE

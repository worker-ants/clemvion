> **복구본**: 원 sub-agent disk write 유실(disk-write gap) — workflow journal.jsonl 반환값에서 복구.

### 발견사항

- **[WARNING]** 신규 i18n 모듈의 `__tests__/` 배치가 `channel-web-chat` 의 100% 일관된 콜로케이트 테스트 컨벤션을 깬다
  - target 신규 식별자: `plan/in-progress/spec-draft-webchat-en-i18n.md §9` "구현 트래커"가 명시한 `codebase/channel-web-chat/src/lib/i18n/__tests__/i18n.test.ts`
  - 기존 사용처: `codebase/channel-web-chat/src` 전체(`lib/*.ts`+`*.test.ts`, `widget/*.ts`+`*.test.ts`, `widget/components/*.tsx`+`*.test.tsx`) — 실측 결과 `foo.ts` 옆에 `foo.test.ts`/`foo.test.tsx` 를 나란히 두는 콜로케이트 패턴이 전 파일(20+개)에 예외 없이 적용돼 있고 `__tests__/` 서브디렉터리는 이 영역에 **0건**(`find ... -type d -iname "__tests__"` 결과 없음). 참고로 `codebase/packages/web-chat-sdk` 는 아예 다른 접미사(`.spec.ts`)를 쓰는 별개 컨벤션이라 더더욱 `__tests__/` 근거가 되지 않는다.
  - 상세: 새 i18n 모듈만 `src/lib/i18n/` 서브디렉터리(이 자체는 `widget/components/` 선례가 있어 큰 문제는 아님) 안에 `catalog.ts`/`resolve-locale.ts`/`context.tsx` 를 두고, 테스트만 별도 `__tests__/i18n.test.ts` 로 몰아 이 영역에서 처음으로 `__tests__/` 패턴을 도입한다. 동일 이름 재사용에 의한 의미 충돌(CRITICAL)은 아니지만, 기존 컨벤션과 어긋나 리뷰어·후속 작업자가 테스트 위치를 예측하기 어렵게 만든다(criterion 6, 파일 경로 컨벤션 이탈).
  - 제안: `i18n.test.ts` 를 `catalog.test.ts`/`resolve-locale.test.ts`/`context.test.tsx` 로 분리해 각 소스 파일과 콜로케이트하거나(기존 관례 그대로), 굳이 통합 테스트 파일 하나로 두고 싶다면 `src/lib/i18n/i18n.test.ts` (서브디렉터리 안이지만 `__tests__/` 없이 flat)로 배치해 이 영역의 flat 콜로케이트 관례를 유지할 것을 권장.

- **[INFO]** `TranslationKey` 타입명 재사용 — 메인 앱 i18n 모듈과 동명, 물리적으로 분리
  - target 신규 식별자: `codebase/channel-web-chat/src/lib/i18n/catalog.ts` 에 신설 예정인 `type TranslationKey`(plan §9)
  - 기존 사용처: `codebase/frontend/src/lib/i18n/core.ts:18` `export type TranslationKey = PathInto<Dict>`
  - 상세: 두 타입은 개념(딕셔너리 경로 union)은 동일하지만 서로 다른 패키지(`channel-web-chat` vs `frontend`)에 속해 import 경합이나 타입 오염이 발생하지 않는다. 오히려 위젯이 메인 앱 i18n 시스템의 명명 관례(`Locale`/`TranslationKey`/`t(key, params?)`)를 의도적으로 미러링하는 것으로 보이며, spec R10·i18n-userguide 개정이 이미 "물리·개념적으로 분리된 자체 catalog" 임을 명문화했다.
  - 제안: 조치 불필요. 다만 두 모듈을 동시에 다루는 코드 리뷰/문서에서 `TranslationKey`를 인용할 때는 `channel-web-chat` vs `frontend` 출처를 명시하면 혼동을 줄일 수 있다.

- **[INFO]** `useTranslation()` 훅 시그니처가 업계 관례(react-i18next)와 이름은 같고 반환 shape 은 다름
  - target 신규 식별자: `context.tsx` 의 `useTranslation()` → `t(key, params?)` 를 **직접 반환**(plan §9: `const t = useTranslation()`)
  - 기존 사용처: 저장소 내부에는 `react-i18next` 의존성 없음(`package.json` 전수 grep 0건)이라 리터럴 충돌은 없음. 다만 `useTranslation()` 은 React 생태계에서 `{ t, i18n }` 객체를 반환하는 `react-i18next` 표준 훅명으로 널리 알려져 있다.
  - 상세: 내부 코드베이스 관점에서는 "기존 사용처"가 없어 criterion 2(엔티티/타입명 충돌)의 엄밀한 정의에는 해당하지 않으나, 신규 기여자가 외부 라이브러리 관례를 기대하고 `const { t } = useTranslation()` 로 구조분해할 경우 `t` 가 `undefined` 가 되는 실수를 유발할 수 있다.
  - 제안: 강제 조치는 불필요하나, 구현 시 훅명을 `useWidgetTranslation()` 또는 `useT()`(메인 앱과 일치)처럼 조금 더 명확히 하거나, JSDoc 에 반환 shape(바로 `t` 함수)을 명시하는 정도로 충분.

- **[INFO]** 신규 위젯 catalog 네임스페이스 vs 기존 admin 콘솔 `webChat` dict — 물리적으로 분리, 실질 충돌 없음
  - target 신규 식별자: 위젯 로컬 catalog 키(`composer.*`/`header.*`/`confirm.*`/`group.*`/`launcher.*`/`carousel.*`/`table.*`/`chart.*`/`form.*`/`error.generic`, `codebase/channel-web-chat/src/lib/i18n/catalog.ts`)
  - 기존 사용처: `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts` — 운영 콘솔이 웹채팅 인스턴스를 관리하는 화면 문자열(`appearance.headerTitle`, `preview.reset` 등)을 담은 **메인 앱 dict 의 `webChat` 네임스페이스**
  - 상세: 두 모듈은 서로 다른 패키지(`frontend` vs `channel-web-chat`)·다른 대상(운영자용 콘솔 UI vs 방문자용 위젯 chrome)이라 실제 키 경로가 겹치지 않는다(`webChat.appearance.headerTitle` ≠ 위젯 `header.defaultTitle`). i18n-userguide 개정(§적용 범위)도 이 분리를 이미 명문화했다.
  - 제안: 조치 불필요. 다만 "webChat" 이라는 용어가 admin dict 네임스페이스로 이미 선점돼 있으므로, 위젯 로컬 catalog 모듈/변수명에 `webChat`(camelCase, 메인 dict 와 동일 표기)을 재사용하지 않도록 주의(plan 이 제시한 `WIDGET_STRINGS`/`catalog.ts` 명명은 이미 이 충돌을 피하고 있어 안전).

새 요구사항 ID(`R10` — 파일 로컬 시퀀스라 충돌 없음, 이전 --spec 라운드에서 이미 확인됨), 새 API endpoint(없음), 새 이벤트/메시지명(`wc:*` 재사용, 신규 없음), 새 ENV var/config key(없음 — `WEBCHAT_IDLE_REAP_GRACE_MS` 등은 기존 EIA-RL-07 것), `resolveLocale`/`resolve-locale.ts`/`WIDGET_STRINGS`/`I18nProvider`/`catalog.ts` 등 구체 식별자는 전수 grep 결과 저장소 전역에서 **0건**(완전 신규, 충돌 없음)이었다.

### 요약
이번 --impl-prep 라운드의 target(`spec/7-channel-web-chat/` 5개 문서, 2026-07-12 `locale` 활성 커밋 기준)이 도입하는 신규 식별자 — 위젯 로컬 i18n catalog(`{ko,en}`)·`t(key,params?)`·`resolveLocale`·`R10`·§4 섹션·번역 key 네임스페이스 — 는 spec 수준에서는 이미 이전 --spec 검토(review/consistency/2026/07/12/14_34_23)에서 NONE 판정을 받았고, 이번에 `plan/in-progress/spec-draft-webchat-en-i18n.md §9` "구현 트래커"가 구체화한 실제 파일 경로(`catalog.ts`/`resolve-locale.ts`/`context.tsx`/`__tests__/i18n.test.ts`)와 심볼명(`WIDGET_STRINGS`/`I18nProvider`/`useTranslation`/`TranslationKey`)을 codebase 전역 grep 으로 재검증한 결과 실질적 이름 충돌은 발견되지 않았다. 다만 구현 착수 직전 시점이므로 `__tests__/i18n.test.ts` 배치가 이 영역이 예외 없이 지켜온 콜로케이트 테스트 관례(`foo.ts`+`foo.test.ts`)를 깨는 점은 WARNING 으로 표면화했고, `TranslationKey`/`useTranslation` 명명은 참고용 INFO 로 기록했다. CRITICAL 은 없다.

### 위험도
LOW

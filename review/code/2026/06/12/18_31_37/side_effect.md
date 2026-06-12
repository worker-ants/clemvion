# 부작용(Side Effect) Review

## 발견사항

### 파일 4: codebase/frontend/src/lib/i18n/backend-labels.ts

- **[INFO]** `ERROR_KO` 모듈 레벨 객체에 5개 키 추가 — 기존 매핑 덮어쓰기 없음
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (ERROR_KO 객체 끝 섹션)
  - 상세: `ERROR_KO`는 `export const` 모듈 레벨 객체다. 신규 키 5종(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`) 추가는 기존 키를 덮어쓰지 않는다. `translateBackendError` 함수의 동작은 변경되지 않고 이전에 `fallback` 문자열을 반환하던 코드들이 이제 한국어 메시지를 반환하게 된다. 이는 의도된 변경이며 기존 호출자에게 breaking 아니나, 이들 코드를 직접 `fallback` 값으로 사용하던 곳이 있다면 런타임 출력이 달라진다.
  - 제안: 전체 앱 내에서 이 5개 코드에 대해 `translateBackendError` 반환값을 직접 비교하거나 고정 문자열로 스냅샷 테스트하던 코드가 없는지 확인 권장. 현재 변경 범위에서는 확인되지 않음.

- **[INFO]** `TRIGGER_NOT_FOUND` 번역이 chat-channel 외 컨텍스트에서 재사용될 경우 의미 불일치 가능성
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (TRIGGER_NOT_FOUND 항목)
  - 상세: 현재 번역 "해당 웹훅 엔드포인트를 찾을 수 없어요."는 chat-channel 어댑터 맥락에 특화된 표현이다. `TRIGGER_NOT_FOUND` 코드가 일반 webhook 경로(`hooks.service.ts`)에서도 발생할 수 있다면, chat-channel 이외 흐름에서도 동일 번역이 적용되어 사용자에게 부정확한 안내가 표시되는 부작용이 생긴다. `ERROR_KO`는 코드 문자열 전역 공유이므로 특정 사용 경로에 한정된 표현을 넣으면 다른 경로 사용자에게 부작용이 발생한다.
  - 제안: `TRIGGER_NOT_FOUND`가 hooks.service.ts 일반 webhook 경로에서도 반환되는지 확인 후, 그렇다면 "해당 트리거를 찾을 수 없어요."처럼 범용 표현으로 교체.

### 파일 3: codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts

- **[INFO]** `LOCALIZED_ERROR_CODES` 정적 배열 확장 — P3-C-2 가드 검증 범위 변경
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` (LOCALIZED_ERROR_CODES 배열)
  - 상세: 테스트 파일의 `LOCALIZED_ERROR_CODES` 배열에 5개 코드가 추가되어 P3-C-2 parity 가드의 검증 범위가 넓어진다. 이 5개 코드가 `ERROR_KO`에 매핑되어 있으므로 기존 테스트는 계속 통과한다. 부작용은 없으며 테스트 강화가 의도된 변경이다. `WORKSPACE_ID_REQUIRED`가 `LOCALIZED_ERROR_CODES`에 포함되지 않은 것은 본 변경과 무관한 기존 상태이나, 이번 추가로 인해 이 생략이 더 눈에 띄게 됐다.
  - 제안: 부작용 없음.

### 파일 6: spec/conventions/cafe24-api-catalog/_generator.py

- **[WARNING]** `resp_param_rows` 컨테이너 fallback 제거 — 재실행 시 광범위한 파일시스템 부작용 발생 가능
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` (`resp_param_rows` 함수, `kind not in ('obj', 'arr')` 조건 추가 라인)
  - 상세: 이번 변경으로 `obj`/`arr` 타입 컨테이너 필드는 더 이상 `req_map`/`global_map`/`variant_map`에서 설명을 가져오지 않는다. 스크립트를 재실행하면 응답 래퍼 컨테이너명이 요청 파라미터명과 겹치는 카탈로그 파일 전체(현재 커밋 외의 ~25개 추정)가 자동으로 수정된다. 이는 의도된 버그픽스의 파급효과이나, 현재 커밋에는 `appstore-orders.md` 1개만 반영되어 있다. 재실행 없이 남겨진 파일들은 현재 수정된 generator 로직과 불일치 상태다.
  - 제안: `cafe24-backlog-residual.md`에 재생성 대상으로 명시되어 있어 의도적 미완이 기록됐다. 그러나 해당 generator를 CI나 자동화 워크플로우가 실행한다면 추가 파일 변경이 예상치 못한 커밋 없는 diff를 만들 수 있다. generator가 수동 CLI 전용임을 확인하고 CI 자동 실행 경로가 없는지 점검 권장.

- **[INFO]** `fetch_entity_json` 캐시 파일 쓰기 — 파일시스템 부작용 (기존 코드, 변경 없음)
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` (`fetch_entity_json` 함수)
  - 상세: `entity_id` 기반 경로로 캐시 파일 읽기/쓰기가 발생한다. 이번 diff에서 이 로직은 변경되지 않았으므로 신규 부작용은 없다. 기존 파일시스템 쓰기 동작 그대로 유지.
  - 제안: 신규 부작용 없음.

- **[INFO]** 외부 네트워크 호출 — `_http_get` / `fetch_entity_json` (기존 코드, 변경 없음)
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` (`_http_get` 함수)
  - 상세: `developers.cafe24.com` 외부 서비스 HTTP 호출 로직은 이번 diff에서 변경되지 않았다. 신규 의도치 않은 네트워크 호출 없음.
  - 제안: 신규 부작용 없음.

### 파일 1: triggers.en.mdx, 파일 2: triggers.mdx

- **[INFO]** 문서 문구 변경 — 런타임 부작용 없음
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx`, `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`
  - 상세: Callout 텍스트만 변경되는 정적 문서 수정이다. 렌더링 결과만 달라지며 함수 시그니처·API·이벤트·상태에 영향 없음.
  - 제안: 부작용 없음.

### 파일 5: plan/in-progress/spec-sync-chat-channel-gaps.md, 파일 7: plan/complete/fix-spec-frontmatter-catalog.md

- **[INFO]** plan 메타데이터 변경 — 런타임 부작용 없음
  - 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md`, `plan/complete/fix-spec-frontmatter-catalog.md`
  - 상세: `worktree` 필드를 `spec-sync-audit` → `(unstarted)` 로 수정하고, `spec_impact` 필드를 신규 추가했다. plan lifecycle 처리 스크립트가 `worktree` 값으로 실제 git worktree 존재를 검증한다면 `spec-sync-audit` worktree가 존재하지 않는 상황에서의 오류를 이 수정이 방지한다. `spec_impact`는 plan 파서가 미지 frontmatter 키에 관대하게 동작하므로 기존 파싱 로직에 부작용 없음.
  - 제안: 부작용 없음.

---

## 요약

이번 변경 세트에서 의도치 않은 부작용의 위험은 낮다. `ERROR_KO`에 5개 신규 키 추가는 기존 매핑을 건드리지 않고 이전에 fallback을 반환하던 코드들이 한국어 메시지를 반환하도록 동작이 바뀌는 것이 유일한 런타임 변화이며 이는 의도된 것이다. 주목할 부분은 두 가지다: 첫째, `TRIGGER_NOT_FOUND` 번역이 chat-channel 맥락 특화 표현("웹훅 엔드포인트")을 사용하고 있어 일반 webhook 경로에서 동일 코드가 발생할 경우 사용자에게 부정확한 안내가 노출되는 부작용이 생길 수 있다. 둘째, `_generator.py`의 컨테이너 fallback 제거 변경은 스크립트를 재실행할 때 현재 커밋에 포함되지 않은 다수 카탈로그 파일에 추가적인 파일시스템 변경을 유발하며, 이는 의도된 동작이지만 `cafe24-backlog-residual.md`에 backlog로 명시되어 있어 관리되고 있다. 전역 변수 도입, 환경 변수 변경, 이벤트/콜백 로직 변경, 외부 네트워크 호출 신규 도입은 이번 변경에 없다.

## 위험도

LOW

STATUS: SUCCESS

# Side Effect Review

## 발견사항

### 파일 1: plan/complete/fix-spec-frontmatter-catalog.md

- **[INFO]** plan 문서 frontmatter에 `spec_impact` 필드 추가
  - 위치: frontmatter (lines 2-9 diff)
  - 상세: plan frontmatter에 `spec_impact` 목록이 추가됐다. 이는 순수 메타데이터 변경이며 런타임 부작용 없음. plan lifecycle 파서가 이 필드를 읽는 코드가 있다면 새 필드를 무시하거나 처리할 준비가 돼 있어야 하지만, 계획 문서 파서는 일반적으로 미지 frontmatter 키에 관대하다.
  - 제안: 영향 없음. 문서상 메타데이터 확장이므로 문제 없음.

---

### 파일 2: codebase/frontend/src/content/docs/02-nodes/triggers.mdx

- **[INFO]** Chat Channel 에러코드 Callout 문구 변경 (UX 문구만)
  - 위치: line 164 (diff)
  - 상세: "일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요" → "한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요"로 변경. 문서 렌더링 텍스트만 바뀌므로 런타임 상태·API·이벤트에 부작용 없음. 단, 이 변경이 실제 i18n 구현(backend-labels.ts ERROR_KO 매핑 추가)과 함께 커밋되었는지 확인 필요 — 해당 구현은 파일 4에서 확인됨.
  - 제안: 파일 4의 ERROR_KO 추가가 같은 PR에 포함되어 문서-구현 동기화가 달성됐다. 부작용 없음.

---

### 파일 3: codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts

- **[INFO]** `LOCALIZED_ERROR_CODES` 배열에 5개 chat-channel 에러코드 추가
  - 위치: lines 667-671 (diff)
  - 상세: 테스트 파일의 정적 배열 확장이다. 이 배열 변경은 `P3-C-2` 테스트 케이스의 검증 범위를 넓힌다. 추가된 코드들이 `ERROR_KO`에 매핑되어 있지 않으면 기존에 통과하던 테스트가 실패(의도된 동작)한다. 파일 4에서 매핑이 추가되었으므로 테스트는 계속 통과한다.
  - 주의: `WORKSPACE_ID_REQUIRED`가 `LOCALIZED_ERROR_CODES`에 없지만 `ERROR_KO`에는 이미 등재되어 있다. 이는 단방향 누락이나 본 변경과 무관한 기존 상태다.
  - 제안: 부작용 없음. 테스트 강화가 의도한 변경이다.

---

### 파일 4: codebase/frontend/src/lib/i18n/backend-labels.ts

- **[INFO]** `ERROR_KO`에 5개 chat-channel 에러코드 한국어 매핑 추가
  - 위치: lines 1158-1167 (diff)
  - 상세: `ERROR_KO`는 모듈 레벨의 `export const` 객체다. 새 키-값 쌍 5개 추가는 기존 키를 덮어쓰지 않으므로 기존 매핑에 부작용 없음. `translateBackendError` 함수의 동작은 변경되지 않으며, 이전에 `fallback` 반환하던 코드들이 이제 한국어 메시지를 반환한다 — 이는 의도된 동작이다.
  - 주의: `TRIGGER_NOT_FOUND`의 번역 "해당 웹훅 엔드포인트를 찾을 수 없어요"는 chat-channel 외에도 일반 트리거 not-found 케이스에서 동일 코드를 재사용할 경우 적용된다. chat-channel 맥락 밖에서도 이 코드가 사용된다면 "웹훅 엔드포인트"라는 표현이 맥락에 맞지 않을 수 있다.
  - 제안: `TRIGGER_NOT_FOUND` 번역이 충분히 일반적인지 확인 권장. spec `§5.4`에서 이 코드가 chat-channel 전용이라면 문제 없음. 일반 webhook 트리거에도 동일 코드가 쓰인다면 "트리거를 찾을 수 없어요"로 더 범용적인 표현이 적절할 수 있음.

---

### 파일 5: plan/in-progress/spec-sync-chat-channel-gaps.md

- **[INFO]** `worktree` frontmatter 값 변경: `spec-sync-audit` → `(unstarted)`
  - 위치: line 2 (diff)
  - 상세: plan 문서의 메타데이터 수정이다. `spec-sync-audit` worktree에 대한 참조가 제거되고 미착수 상태로 표시됐다. 런타임 부작용 없음. plan lifecycle 처리 스크립트나 훅이 `worktree` 값으로 실제 git worktree 존재를 검증한다면 `spec-sync-audit`이 삭제된 이후 이 수정은 올바른 정리다.
  - 제안: 부작용 없음.

---

### 파일 6: spec/conventions/cafe24-api-catalog/_generator.py

- **[WARNING]** `resp_param_rows` 함수의 fallback 로직 조건부 변경 — 기존에 컨테이너 필드에도 적용되던 cross-map fallback이 이제 스칼라 전용으로 제한됨
  - 위치: lines 2005-2006 (diff), `resp_param_rows` 함수 내
  - 상세: `kind not in ('obj', 'arr')` 조건 추가로 컨테이너 타입 필드의 설명이 `req_map`/`global_map`/`variant_map`에서 더 이상 가져오지 않는다. 이는 **이미 생성된 카탈로그 파일을 재생성할 경우** 컨테이너 필드의 설명이 달라질 수 있다. 파일 7이 이 변경의 실제 결과물을 보여준다 (`order` 필드: "정렬 순서 asc…" → "(응답 객체)").
  - 파일시스템 부작용: 이 스크립트를 실행하면 `spec/conventions/cafe24-api-catalog/<resource>/<entity>.md` 파일들 중 응답 래퍼 컨테이너 이름이 요청 파라미터명과 겹치는 경우 설명이 변경된다. 파일 7이 이미 반영됐으므로 현재 커밋에서는 일관성이 있다.
  - 주의: 스크립트를 미래에 재실행하면 파일 7 외에도 유사한 이름 충돌이 있는 다른 카탈로그 파일들이 수정될 수 있다. 이는 의도된 동작이지만, 재실행 시 광범위한 파일 변경이 발생할 수 있음을 인지해야 한다.
  - 제안: 의도된 버그픽스이나, 이 스크립트 실행이 CI에 자동화되어 있다면 재실행 시 추가 카탈로그 파일 변경이 커밋에 포함되어야 한다. 현재 커밋의 파일 7만 반영된 것이 전부인지, 아니면 다른 영향받은 파일들이 누락되었는지 확인 권장.

- **[INFO]** 네트워크 호출 패턴 (기존 코드, 변경 없음)
  - 위치: `_http_get`, `fetch_entity_json` 함수
  - 상세: 이번 diff에서 네트워크 호출 로직은 변경되지 않았다. 기존 external HTTP fetch (developers.cafe24.com) 패턴은 그대로 유지된다.

---

### 파일 7: spec/conventions/cafe24-api-catalog/application/appstore-orders.md

- **[INFO]** 생성기 변경 결과물 — `order` 컨테이너 필드 설명 수정
  - 위치: lines 46, 94 (diff)
  - 상세: "정렬 순서 asc : 순차정렬 · desc : 역순 정렬" → "(응답 객체)"로 변경. 이는 파일 6의 generator 로직 수정의 직접 결과물이다. 정적 문서 변경이며 런타임 부작용 없음.

---

## 요약

변경 전반에서 의도하지 않은 부작용은 발견되지 않는다. 주요 변경은 (1) i18n ERROR_KO에 chat-channel 에러코드 5개 추가 및 대응 테스트 가드 강화, (2) triggers.mdx 문서 문구를 구현 완료 사실에 맞게 수정, (3) cafe24 catalog generator의 컨테이너 필드 설명 cross-map fallback 제거(버그픽스)와 그 결과물 파일 반영이다. `TRIGGER_NOT_FOUND` 번역의 맥락 범용성 여부와, generator 재실행 시 appstore-orders.md 외 추가 카탈로그 파일이 더 변경되지 않았는지 확인할 것을 권장한다.

## 위험도

LOW

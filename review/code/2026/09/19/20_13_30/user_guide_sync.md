# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 발견사항

- **[INFO]** `02-nodes/triggers.mdx` (+`.en.mdx`) 의 webhook `endpoint_path` 설명이 V133 의 영구 예약(tombstone) 의미를 반영하지 않음 — 단, 이미 검토·수용된 결정과 같은 계열
  - 변경 파일 (trigger): `codebase/backend/src/modules/triggers/triggers.controller.ts` (Swagger jsdoc 상수 갱신), `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict` 의미 확장 — 전역 UNIQUE 위반뿐 아니라 "다른 워크스페이스가 예약한(지웠거나 바꾼) 경로" 도 같은 409 로 매핑)
  - 매트릭스 항목: `doc-sync-matrix.json` `id: "backend-api-change"` (glob `codebase/backend/src/**/*.controller.ts`, match: semantic) — targets 원문: "controller·DTO 의 swagger jsdoc" / "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지". PROJECT.md §변경 유형→갱신 위치 매핑 169행 원문 동일. 같은 절 "DOCUMENTATION 단계 종료 사전 체크리스트" 는 "회색 지대는 보수적으로 '갱신 필요' 로 분류" 를 명시.
  - 관련(미변경) 파일: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:87,95`, `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx:84` — "이 경로는… 서비스 전체에서 유일해서, 다른 워크스페이스가 같은 경로로 트리거를 등록할 수 없어요" / "이미 경로를 알고 있더라도 다른 워크스페이스에 같은 경로로 등록하려 하면 거부돼요 — 경로는 서비스 전체에서 유일해야 하거든요."
  - 상세: 이 문장은 V132(동시 존재 시 전역 UNIQUE) 시점 서술이고, **여전히 사실**이라 틀리지는 않는다 — 다만 V133 이 추가한 "지우거나 바꾼 경로도 다른 워크스페이스가 영원히 못 쓴다(같은 워크스페이스는 재사용 가능)" 는 더 강한 보장은 언급이 없다. 실제로 이 PR 은 `spec/1-data-model.md`(§2.8.1 Rationale) · `spec/2-navigation/2-trigger-list.md` · `spec/5-system/12-webhook.md` · `spec/5-system/3-error-handling.md` · `spec/data-flow/10-triggers.md` 5개 spec 파일은 모두 갱신했지만, `codebase/frontend/src/content/docs/**` (실제 최종 사용자 가이드)는 이번 변경 set 에 없다.
    다만 이 갭은 이미 두 겹으로 검토됐다: (1) `spec/1-data-model.md` Rationale 이 "UI 고지(삭제 확인 다이얼로그·경로 변경 경고 — `2-trigger-list.md §4.2·§2.3.1`)도 더하지 않았다 — 소유자의 워크스페이스 안에서는 달라지는 것이 없고, 다른 워크스페이스로 옮기려는 경우는 그 자리의 409 가 알린다" 는 근거를 명시적으로 남겼고, (2) 같은 변경 set 안의 `review/code/2026/09/19/19_44_33/documentation.md` (일반 문서화 리뷰, LOW 위험도) 가 spec 5개 파일 전체·CHANGELOG·마이그레이션 헤더까지 전수 검토한 뒤 "UI 고지는 planner 가 명시적으로 근거를 남긴 결정이며 --spec/--impl-prep 두 라운드 모두 INFO 로 검토·수용됨 — 재지적하지 않음" 이라고 이미 판정했다. 그 판정은 `2-trigger-list.md`(in-app 다이얼로그)를 대상으로 했고 `content/docs/02-nodes/triggers.mdx`(정적 가이드 산문)를 문자 그대로 다루진 않았지만, 근거("소유자 관점에서 달라지는 것이 없다·충돌은 기존 409 로 이미 안내됨")는 동일하게 적용된다. 가이드 문구도 이미 "다른 워크스페이스가 등록하면 거부된다"는 결과를 서술 중이라 오도하는 내용은 없다.
  - 제안: 별도 조치는 선택 사항. 팀이 이 문구를 정말 강화하고 싶다면 `triggers.mdx:95` / `triggers.en.mdx:84` 한 문장에 "지우거나 경로를 바꿔도 그 경로는 계속 우리 워크스페이스 소유로 남는다(다른 워크스페이스는 영원히 못 씀)"을 덧붙이는 정도로 충분 — 필수 차단 사유는 아님. 이미 동일 근거로 두 번 검토·수용된 사안이므로 재지적성 fix PR 을 만들 필요는 없다고 판단.

## 정합성이 확인된 항목 (오탐 방지용 기록)

- **i18n parity**: 이번 변경 set 에 `codebase/frontend/**/*.tsx` 변경이 전혀 없다 — 신규 UI 문자열 트리거 없음, dict `{ko,en}` 양쪽 정합 이슈 없음.
- **backend-labels.ts (WARNING_KO/ERROR_KO)**: `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 **기존** 세부 코드(V132 도입)이며 이번 PR 이 신규로 발행하는 코드가 아니다 — 매핑 대상이 늘지 않았다. 또한 사용자에게 보이는 메시지("그 엔드포인트 경로는 쓸 수 없어요. 새 경로를 쓰세요.")는 `triggers.service.ts` `rethrowEndpointPathConflict()` 가 **이미 한국어로 직접** 생성해 보낸다 — `backend-labels.ts` 매핑 레이어를 거치지 않으므로 영문 노출 위험이 없다(코드: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict`).
- **새 섹션 디렉토리 / locale.ts**: `codebase/frontend/src/content/docs/<NN>-<name>/` 신규 디렉토리 없음 — 해당 없음.
- **노드 추가/스키마 변경**: `codebase/backend/src/nodes/**` 변경 없음(웹훅 트리거 로직은 `modules/triggers/**` 소관, 노드 트리거 아님) — 해당 없음.
- **통합/제공자 변경, 표현식 언어 변경, 인증·세션 흐름 변경(`modules/auth/**`), 실행·디버깅 흐름 변경, 신규 BullMQ 큐**: 매칭되는 변경 파일 없음 — 해당 없음.
- **spec 5개 파일**은 매트릭스 "spec-major-change" 트리거에 걸리지만(§`2-*`/`5-*`), frontmatter `code:`/`status:` 정합은 이미 이 PR 안에서 3라운드 consistency-check(2026-09-19 18:56/19:11/19:21, CRITICAL 0·WARNING 0 최종 수렴)가 검증했다 — user-guide-sync 관점에서 별도 재검증 불필요.

## 요약

매트릭스 20행 중 실제 매칭된 것은 "백엔드 API 추가·변경"(`triggers.controller.ts`/`triggers.service.ts`) 1건뿐이며, 그 target (b) "관련 user-guide 페이지"에 대해 `02-nodes/triggers.mdx`(+`.en.mdx`)가 V133 의 영구 예약 뉘앙스를 반영하지 않은 회색 지대 1건을 INFO 로 남긴다 — 다만 이는 spec Rationale 의 명시적 결정 및 같은 변경 set 의 일반 문서화 리뷰(LOW)가 이미 같은 근거로 검토·수용한 사안과 사실상 동일선상이라 신규 결함으로 보기 어렵다. i18n dict parity·backend-labels.ts(WARNING_KO/ERROR_KO)·새 섹션 locale 등록·노드/통합/인증/표현식/실행-디버깅 트리거는 이번 변경 set 에 전혀 매칭되지 않았다(CRITICAL 0건, WARNING 0건).

## 위험도

LOW

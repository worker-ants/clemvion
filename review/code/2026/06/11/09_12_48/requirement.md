# 요구사항(Requirement) Review

## 발견사항

### [INFO] 주석 개선 — 배너 vs 진행 박스 데이터 출처 명시
- 위치: `/codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 라인 617–619 (변경된 주석)
- 상세: 배너가 KB REST 응답(+WS)의 `reembedStatus`를, 진행 박스가 `embeddingStats` 폴링의 `reembedStatus`를 각각 본다는 사실을 주석에 명시한 것은 실제 코드 동작과 일치한다. 재임베딩 직후 일시적 불일치 가능성을 인지하고 문서화한 점은 바람직하다. 기능 오류 없음.
- 제안: 유지.

### [INFO] [SPEC-DRIFT] 배너 데이터 출처 이중성(REST vs 폴링)이 spec에 미반영
- 위치: `/codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 라인 617–619 주석
- 상세: 구현은 배너가 `kb.reembedStatus`(KB REST + WS 캐시 invalidate 경로)를, 진행 박스는 `embeddingStats.reembedStatus`(polling 경로)를 별도 소스로 보는 설계를 채택했다. 이 의도적 이중 출처 구조는 spec `2-navigation/5-knowledge-base §2.4.1`에 서술되어 있지 않다. spec 본문은 배너가 어떤 API 응답에서 `reembedStatus`를 읽는지 명시하지 않으며, "배너는 KB 자체 상태만 반영한다"는 동작 명세가 누락된 상태다. 코드가 합리적이고 의도적이므로 코드 버그가 아니라 spec 갱신 누락이다.
- 제안: 코드 유지 + spec 반영. `/spec/2-navigation/5-knowledge-base.md §2.4.1` "검색 불가 배너" 항목에 "배너는 `GET /knowledge-bases/:id` REST 응답(+WS invalidate)의 `reembedStatus`를 사용하며, 아래 진행 박스의 `embeddingStats` 폴링과 출처가 다르다 — 재임베딩 직후 일시적 불일치 가능"을 한 줄 추가.

### [INFO] `STATE_CONFIG` 테이블 방식 리팩토링 — 기능 완전성 충족
- 위치: `/codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`
- 상세: 기존 `inProgress` 불리언 분기를 `STATE_CONFIG` 레코드로 교체했다. `ReembedStatus`가 `KnowledgeBaseData["reembedStatus"]`("idle" | "in_progress")에서 파생되므로, 타입 유니온이 늘어나면 컴파일 타임에 `Record<ReembedStatus, ...>` 불완전 오류로 잡힌다. 설계 의도와 구현이 일치한다.

### [INFO] 테스트: `admin` 단일 케이스 → `it.each(["admin", "owner"])` 확장
- 위치: `/codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx` 라인 1078–1089
- 상세: `admin` 만 검증하던 테스트를 `owner`까지 확장했다. RoleGate 계층(`viewer < editor < admin < owner`)상 `minRole="editor"` 조건에서 admin과 owner 모두 통과해야 하는 회귀 방지 테스트로 적절하다.

### [INFO] `null` 역할 케이스 미테스트
- 위치: 테스트 파일 전반
- 상세: `setRole(null)`(워크스페이스 없음/미인증 상태) 케이스가 테스트되지 않는다. `UnsearchableBanner`는 항상 `embeddingDimension == null` 조건에서만 렌더되어 로그인 필수이므로 현실적으로 null role이 도달할 가능성은 낮다. 기능적 위험 없음.

### [INFO] `pending` prop 미전달 시 기본값 동작
- 위치: `unsearchable-banner.tsx` 라인 1454
- 상세: `pending`은 optional(`pending?: boolean`)이며 미전달 시 `undefined`로 `disabled={undefined}`가 된다. React는 이를 `disabled={false}`와 동일하게 처리하므로 CTA가 활성화된다. 의도된 동작. 엣지 케이스 처리 정상.

### [WARNING] `STATE_CONFIG`가 `'idle'`·`'in_progress'` 두 상태만 처리 — 런타임 미지 상태 방어 없음
- 위치: `unsearchable-banner.tsx` 라인 1429 `const cfg = STATE_CONFIG[reembedStatus];`
- 상세: `ReembedStatus` 타입이 현재 `"idle" | "in_progress"` 유니온이라 컴파일 타임에는 안전하다. 그러나 `KnowledgeBaseData.reembedStatus` 타입이 확장되거나 서버에서 예상치 못한 값이 내려올 경우(예: `"failed"`, `"completed"` 등) `STATE_CONFIG[reembedStatus]`가 `undefined`가 되어 `cfg.icon`에서 런타임 오류가 발생한다. 호출부(`page.tsx`)에서 이미 `kb.embeddingDimension == null` 조건으로 게이트하므로 실제 위험은 제한적이나, 방어적 fallback이 없다.
- 제안: `const cfg = STATE_CONFIG[reembedStatus] ?? STATE_CONFIG["idle"];` 와 같이 fallback을 두거나, 타입 가드를 추가해 미지 상태에서 안전 동작을 보장.

## 요약

변경의 핵심은 (1) `unsearchable-banner.tsx`의 `inProgress` 이진 분기를 `STATE_CONFIG` 테이블로 리팩토링하고 타입을 도메인 타입에서 파생시킨 것, (2) `page.tsx`에서 배너 데이터 출처(KB REST vs embeddingStats 폴링)를 주석으로 명시한 것, (3) 역할 계층 회귀 테스트를 `admin`에서 `admin + owner`로 확장한 것이다. 세 변경 모두 spec `2-navigation/5-knowledge-base §2.4.1·R-3`이 요구하는 동작(idle/in_progress 상태별 배너, RoleGate(editor) CTA, 수동 닫기 없음, 상태 기반 자동 소멸)을 충실히 구현하고 있다. 유일한 기능적 우려는 `STATE_CONFIG` 테이블에 런타임 미지 상태에 대한 방어 코드가 없다는 점(현재 타입 유니온 범위 내에서는 안전)이며, 배너의 이중 데이터 출처 구조는 코드가 옳고 spec이 미반영 상태다.

## 위험도

LOW

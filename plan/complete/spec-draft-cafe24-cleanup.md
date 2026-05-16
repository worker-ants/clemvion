---
worktree: cafe24-fields-spec-update-e7a3f2
started: 2026-05-16
owner: project-planner
---

# Spec Draft: spec/4-nodes/4-integration/4-cafe24.md 3건 정리

## 배경

위임 plan: `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md` (PR #62 후속). 본 draft 는 그 plan 의 필수+선택 3건을 한 번의 spec write 로 해소한다.

## 변경 1 (필수) — Fields UI 편집 버퍼 분리 원칙 기록

**위치 1: `§2 설정 UI` 의 Fields 불릿 확장**

기존 (L57):
```markdown
- Fields: Operation 선택 시 메타데이터의 입력 스키마(JSON Schema 호환 형식) 로 동적 폼 렌더. Required / Optional 두 그룹으로 분리.
```

신규:
```markdown
- Fields: Operation 선택 시 메타데이터의 입력 스키마(JSON Schema 호환 형식) 로 동적 폼 렌더. Required / Optional 두 그룹으로 분리.
  - **편집 버퍼**: UI 는 내부적으로 `Array<{key, value}>` 편집 버퍼를 React state 로 관리하고, `onChange` 시 빈 key 행을 제거한 뒤 `Record<string, unknown>` 로 변환해 `config.fields` 에 저장한다. 빈 key 행을 즉시 버퍼에서 떨어뜨리지 않도록 해 "추가" 버튼이 행을 즉시 보여준다.
```

**위치 2: `§9 Rationale` 에 새 `9.5` 절 추가** (기존 §9.5 는 §9.6 로 밀고, 이후 절도 순번 +1 — but to minimize cross-reference churn, append as **§9.9** at the end of Rationale section before CHANGELOG)

신규 §9.9:
```markdown
### 9.9 Fields 편집 UI 의 내부 버퍼 분리

대안:
- (A) `config.fields` 를 그대로 컴포넌트 state 의 원천으로 사용 — 빈 key 행이 object 변환 시 즉시 제거되어 "추가" 버튼이 행을 보여주지 못한다 (PR #62 가 해결한 버그).
- (B, 채택) **내부 편집 버퍼** — `Array<{key, value}>` 형태로 React state 에 유지. `onChange` 시 빈 key 행을 제거하고 `Record<string, unknown>` 로 변환해 `config.fields` 에 propagate. 외부에서 `config.fields` 가 다른 reference 로 바뀌면 (undo/redo, 프로그래밍적 reset) 다음 렌더에서 버퍼를 재동기화한다.

**적용 범위**: 본 결정은 **object-shaped backend contract** (`config.X: Record<string, unknown>`) 를 가진 통합 노드에 한정한다. `http_request` 의 `headers` / `queryParams` 처럼 `KeyValue[]` 형태로 직렬화하는 노드는 빈 key 행도 그대로 echo 되므로 본 버퍼 분리 패턴 적용 대상 외다. backend 가 받는 직렬화 형식 (`Record<string, unknown>`) 은 불변이다 (§1 config 스키마 — 변경 시 본 결정 재검토 필요).

> 출처: consistency-check 세션 `review/consistency/2026/05/16/09_03_04/SUMMARY.md` (INFO 1·2 — cross_spec + rationale_continuity 동일 위배 통합).
```

## 변경 2 (선택) — §9.7 / §9.8 순서 정리

**현 상태 (파일 L404-450)**:
- L404 `### 9.7 OAuth scope wire format — 콤마 구분 (RFC 6749 예외)` — 헤더만, 본문 없음
- L406-437 `### 9.8 Private 앱 App URL HMAC 검증` — 본문 포함
- L439-450 — 9.7 의 본문 (orphan, 9.8 본문 뒤에 잘못 위치)

**조치**:
1. L439-450 의 9.7 본문 (`Cafe24 의 /oauth/authorize 는 ...` 부터 `... %20 으로 회귀하지 않는지 명시 검증.` 까지) 을 잘라서 L404 의 9.7 헤더 바로 뒤로 이동.
2. 결과: 9.7 header → 9.7 body → 9.8 header → 9.8 body → (빈 줄) → `## 10. CHANGELOG`.

순번 자체는 그대로 (9.7 / 9.8). CHANGELOG 외부 참조 영향 없음.

## 변경 3 (선택) — §5 Case 번호 연속화 — **드롭 (의도된 컨벤션)**

**조사 결과**: §5.1 / §5.3 / §5.8 sparse 번호는 cafe24 만의 결함이 아니라 **4 integration 노드 전체의 공유 컨벤션** 이다.

- `1-http-request.md`: §5.1 (성공) · §5.3 (4xx/5xx/transport) · §5.8 (pre-flight throw)
- `2-database-query.md`: §5.1 (성공) · §5.3 (런타임 에러) · §5.8 (pre-flight throw)
- `3-send-email.md`: §5.1 (성공) · §5.3 (runtime 전송 실패) · §5.4 (Integration stub) · §5.8 (pre-flight throw)
- `4-cafe24.md`: §5.1 (성공) · §5.3 (API 에러/transport) · §5.8 (pre-flight throw)

`spec/4-nodes/4-integration/0-common.md` §7 의 노드 출력 색인표 (L116-121) 도 이 sparse 번호를 기준으로 노드 간 같은 카테고리 (성공·런타임 에러·pre-flight) 를 동일 번호로 정렬한다 — HTTP status code 의 자릿수 의미와 유사한 분류 스키마.

cafe24 한 파일만 연속 번호 (5.1/5.2/5.3) 로 바꾸면 위 cross-node alignment 가 깨지고 0-common.md 색인이 cafe24 만 예외로 표기해야 한다. 의도된 컨벤션을 위반하지 않기 위해 **변경 3 은 적용하지 않는다**.

consistency-check INFO 4 (§5 Case 번호 불연속) 는 cafe24 단일 파일만 본 결과 — 본 worktree 에서 cross-node 컨벤션을 확인해 false positive 로 판정.

## CHANGELOG 추가 (§10)

```markdown
| 2026-05-16 | 본문 정리 (코드/계약 무변경) — §2 설정 UI 에 fields 편집 버퍼 분리 원칙 한 줄 추가, §9 Rationale 에 §9.9 신설 (PR #62 후속), §9.7 본문 위치 정정 (편집 오류 수정 — 9.8 뒤에 orphan 으로 있던 본문을 9.7 헤더 바로 뒤로 이동, 내용 변경 없음). 출처: `review/consistency/2026/05/16/09_03_04/` INFO 1·2. §5 Case 번호 sparse 스키마 (5.1·5.3·5.8) 는 4 integration 노드 공유 컨벤션으로 확인되어 변경하지 않음. |
```

## 영향 범위

- **변경 파일**: `spec/4-nodes/4-integration/4-cafe24.md` 1건만
- **코드/API/데이터모델 변경**: 없음
- **다른 spec 영향**: 외부 anchor 검색 결과 없음 (§9.7/§9.8 외부 참조 0건, §5 번호는 cross-node 컨벤션이라 변경하지 않음).
- **병렬 작업 순서**: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree `cafe24-app-url-reuse-f9a2e3`) 가 같은 파일 §9.4 (Private 앱 install_token 흐름) 갱신을 위임 받고 있다. 본 draft 의 §9 영역 편집은 **§9.7/§9.8 위치 정정 + §9.9 신설** 만 다루므로 §9.4 와 직접 충돌하는 hunk 는 없으나, merge 충돌 가능성을 줄이기 위해 두 plan 의 PR 가 시간상 가까이 들어오면 cherry-pick 순서를 `app-url-reuse` 먼저 → 본 작업 으로 직렬화한다.

## 작업 항목

- [x] Draft 작성
- [x] cross-reference 외부 검색 (`§9.7/§9.8` 외부 anchor 0건, `§5.1/§5.3/§5.8` 은 cross-node 컨벤션이므로 변경하지 않음)
- [x] `/consistency-check --spec` 호출 — 세션 `review/consistency/2026/05/16/11_36_49/` BLOCK: NO. WARNING 4건 모두 draft 갱신으로 해소.
- [x] spec 본문 반영 (변경 1·2)
- [x] CHANGELOG 갱신
- [x] `user-guide-sync-2026-05-16.md` W4 항목에 false positive 주석 추가
- [x] 위임 plan + 본 draft `plan/complete/` 로 `git mv` 이동
- [ ] PR 등록

# 보안(Security) 리뷰 결과

리뷰 대상: `multiselect-widget` 변경 세트 (파일 7개)
리뷰 일시: 2026-05-26

---

## 발견사항

### [INFO] 절대 경로가 내부 인프라 정보를 노출하는 상태 파일
- 위치: `review/consistency/2026/05/26/17_18_37/_retry_state.json` — `session_dir`, `prompt_file`, `output_file` 값 전체
- 상세: `_retry_state.json` 파일에 `/Volumes/project/private/clemvion/.claude/worktrees/…` 형태의 로컬 절대 경로가 하드코딩되어 있다. 이 파일이 공개 저장소에 커밋되면 머신 이름·사용자 홈 디렉터리·프로젝트 경로 등 내부 환경 정보가 외부에 노출된다. 코드 실행에 영향을 주는 시크릿은 아니지만, 공격자가 CI/배포 환경을 추론하거나 사회공학적 공격의 보조 정보로 활용할 수 있다.
- 제안: `review/**/_retry_state.json` 파일을 `.gitignore`에 추가하거나, 경로 값을 저장 시 상대 경로 또는 `${SESSION_DIR}` 방식의 치환 변수로 저장하도록 오케스트레이터 로직을 수정한다.

---

### [INFO] 보안 민감 맥락 문자열의 평문 UI 노출 (정보성)
- 위치: `widgets.tsx` `MultiSelectWidget` — `SECTIONS_HINT_EN` 상수 (`multi-select-widget.test.tsx` 라인 50-52 에서도 동일 문자열 사용)
- 상세: `"Selecting 'Workspace' or 'Node' sends internal ids and labels to the LLM provider as plain text."` 라는 경고 힌트가 UI에 표시된다. 이것은 의도된 동작이며 사용자에게 데이터 흐름을 고지하는 올바른 설계이다. 다만, 해당 힌트는 "내부 ID와 라벨이 외부 LLM 공급자에게 전송된다"는 사실을 명시적으로 인정하는 문구로, 힌트 자체가 데이터 유출 위협을 나타내지는 않지만 해당 기능의 데이터 흐름이 실제로 안전하게 처리되고 있는지(전송 암호화, 공급자 계약, 개인정보 처리방침 고지 여부)를 별도로 검토할 필요가 있음을 상기시킨다.
- 제안: 이 항목은 코드 변경 자체의 취약점이 아니라 관련 기능(LLM 공급자 연동)의 데이터 처리 정책이 적절히 문서화·고지되어 있는지 확인하는 체크포인트로 활용한다. 전송 암호화(HTTPS) 및 LLM 공급자 계약 조건 확인을 권장한다.

---

### [INFO] `value` 타입 미검증 — 비신뢰 값이 `string[]`로 캐스팅됨
- 위치: `widgets.tsx` `MultiSelectWidget` 라인: `const selected = Array.isArray(value) ? (value as string[]) : [];`
- 상세: `value`가 배열임을 확인한 뒤 `string[]`로 캐스팅하지만, 배열 원소가 실제로 문자열인지 검증하지 않는다. DB나 외부 소스에서 `[{ id: 1 }, { id: 2 }]`와 같은 객체 배열이 전달되면 `selected.includes(optionValue)` 비교는 항상 false이고, `onChange(next)` 에서 객체가 포함된 배열이 상위 컴포넌트로 전파된다. 이 컴포넌트는 설정 패널(editor settings panel) 수준의 프론트엔드 UI이므로 직접적인 보안 취약점 등급은 낮으나, 의도치 않은 객체가 AI 노드 설정으로 저장·전송될 경우 LLM 공급자 API 호출 시 비정상 페이로드를 생성할 수 있다.
- 제안: `selected` 배열을 생성할 때 원소를 `String()` 으로 강제 변환하거나, `value.filter(v => typeof v === 'string')` 방식으로 문자열 원소만 추출한다.

---

## 요약

이번 변경 세트(multiselect widget 구현)는 순수 프론트엔드 UI 컴포넌트 추가로, 하드코딩된 시크릿·인증 로직·서버사이드 처리가 없어 고위험 보안 취약점은 발견되지 않았다. SQL 인젝션·XSS·커맨드 인젝션·LDAP 인젝션 등의 인젝션 계열 취약점은 해당 없다. 다만 세 가지 정보성 항목이 식별되었다: (1) `_retry_state.json`에 포함된 내부 절대 경로가 공개 저장소 커밋 시 환경 정보를 노출할 수 있고, (2) workspace/node 데이터가 외부 LLM 공급자에게 평문으로 전송된다는 경고 힌트는 그 배경 기능의 데이터 처리 정책 검토를 상기시키며, (3) value 배열 원소의 타입 미검증은 비정상 값이 상위로 전파될 수 있는 경미한 결함이다. 전반적으로 이 PR의 보안 위험도는 낮다.

---

## 위험도

LOW

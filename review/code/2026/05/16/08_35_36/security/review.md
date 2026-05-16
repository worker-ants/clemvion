# 보안(Security) 코드 리뷰

대상 세션: `review/code/2026/05/16/08_35_36`
리뷰어: Security
분석 파일 수: 11개 (MDX 문서 8개 + plan 1개 + consistency review 2개)

---

## 발견사항

### INFO 등급

- **[INFO]** `$thread.turns[0].data.email` 표현식 예시가 문서에 노출됨
  - 위치: `frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx` (추가된 라인 `{{ $thread.turns[0].data.email }}`), `frontend/src/content/docs/02-nodes/ai.en.mdx` 동일 예시
  - 상세: `$thread.turns[0].data.email` 은 사용자 form 입력의 이메일 필드를 직접 참조하는 예시 표현식이다. 이 자체는 문서상 예시이므로 코드 취약점은 아니나, 최종 사용자 데이터(개인식별정보)가 `$thread.data` 구조체를 통해 워크플로우 표현식으로 자유롭게 접근된다는 사실을 문서가 공개하고 있다. 이는 설계 의도에 부합하지만, `$thread` 에 push 된 data 객체 전체에 대한 접근 제어(어떤 노드가 어떤 thread turn 을 읽을 수 있는지)가 런타임 레벨에서 별도로 보장되어야 함을 의미한다.
  - 제안: 문서에 "thread 내 data 객체는 워크플로우 실행 컨텍스트 안에서만 접근 가능하며, 외부로 노출되지 않습니다" 같은 보안 경계 설명을 추가하는 것을 검토한다. 실제 구현 측에서는 `$thread` 가 HTTP 응답이나 로그에 직렬화되지 않도록 직렬화 필터가 적용되어 있는지 확인 필요.

- **[INFO]** Cafe24 통합 문서에서 `integrationId` (UUID) 를 config 예시에 `"…"` 플레이스홀더로 표시
  - 위치: `frontend/src/content/docs/02-nodes/integrations.en.mdx` 및 `integrations.mdx` 의 Example 코드 블록 (`integrationId: "…"`)
  - 상세: 실제 UUID 값이 아닌 플레이스홀더가 사용되어 하드코딩된 시크릿 문제는 없음. 다만 `integrationId` 가 OAuth 토큰과 연결된 민감한 식별자임을 사용자가 인지하지 못할 경우, 이를 코드나 공개 저장소에 노출할 위험이 있다. 문서 자체는 문제없음.
  - 제안: 예시 주석 또는 Callout 에 "integrationId는 민감한 자격증명 참조 ID이므로 소스 코드·공개 저장소에 하드코딩하지 마세요" 안내 추가를 고려.

- **[INFO]** `contextScope: thread` 설정 시 전체 Conversation Thread 가 LLM 에 전달된다는 잠재적 데이터 노출 경로
  - 위치: `frontend/src/content/docs/02-nodes/ai.en.mdx` 및 `ai.mdx` — `contextScope: thread` 설명 섹션
  - 상세: 문서가 `contextScope: thread` 사용 시 워크플로우 내 모든 turn(form 입력, 사용자 메시지 포함)이 LLM API 호출 페이로드에 포함된다고 명시한다. 이는 사용자의 개인정보·민감 입력이 제3자 LLM 서비스(OpenAI/Anthropic)로 전송될 수 있음을 의미한다. 문서 자체의 취약점은 아니나, 이 위험을 사용자에게 충분히 안내하고 있는지 검토가 필요하다. 현재 문서는 "토큰 사용량이 빠르게 늘 수 있어요"(토큰 비용 관점)만 언급하고 개인정보 전송 측면은 언급하지 않는다.
  - 제안: `contextScope: thread` 설명에 "thread 에 포함된 사용자 입력이 외부 LLM 서비스로 전송될 수 있으므로, 개인정보·민감 데이터를 포함하는 경우 데이터 처리 정책을 확인하세요" 류의 주의 문구 추가를 검토.

---

## 보안 관점 항목별 평가

| 점검 항목 | 결과 | 비고 |
|---|---|---|
| 인젝션 취약점 | 이상 없음 | 순수 문서 변경. 런타임 코드 없음 |
| 하드코딩된 시크릿 | 이상 없음 | 예시에 플레이스홀더 사용, 실제 값 없음 |
| 인증/인가 | 이상 없음 | 문서 범위. Cafe24 OAuth 흐름은 deep-link 로 위임 |
| 입력 검증 | 이상 없음 | 문서 범위 |
| OWASP Top 10 | 이상 없음 | 해당 없음 (문서 파일) |
| 암호화 | 이상 없음 | 해당 없음 |
| 에러 처리 | 이상 없음 | error 포트 설명은 일반적 수준. 민감 정보 노출 없음 |
| 의존성 보안 | 이상 없음 | 패키지 변경 없음 |

---

## 요약

이번 변경은 전적으로 사용자 매뉴얼 MDX 파일(AI Agent contextScope 필드 갱신, Cafe24 통합 노드 섹션 추가, $thread 변수 섹션 추가)과 plan/review 마크다운 문서의 추가로 구성되어 있다. 런타임 코드·의존성·인프라 설정 변경이 전혀 없으므로 인젝션, 하드코딩 시크릿, 인증/인가, 암호화 등 전통적 보안 취약점 범주에 해당하는 문제는 발견되지 않는다. 다만 문서가 설명하는 기능($thread 를 통한 form 입력 데이터 접근, contextScope: thread 로 전체 대화 내용이 외부 LLM API 로 전달됨)은 개인정보 처리 관점에서 사용자 안내가 보완될 여지가 있다. 이는 문서 품질 개선 수준의 권고이며 보안 결함은 아니다.

---

## 위험도

**NONE**

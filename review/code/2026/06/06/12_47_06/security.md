# 보안(Security) 리뷰 결과

## 발견사항

### 발견사항 없음 — 보안 관련 이슈 미탐지

이번 변경 세트(파일 1~12)는 **테스트 파일 추가/수정**, **프론트엔드 UI 순수함수 추출**, **spec/문서 갱신**으로 구성된다. 각 점검 항목별 분석 결과는 다음과 같다.

---

**[INFO] 1. 인젝션 취약점**
- 위치: 전 파일
- 상세: 변경된 코드는 테스트 파일(`*.spec.ts`, `*.test.ts`) 및 UI 순수함수(`embedding-model-recommendation.ts`)와 spec 문서다. SQL·HTML·커맨드·경로 조작에 노출되는 운영 코드 변경이 없다. `rag-search.service.spec.ts` 에서 SQL 문자열을 직접 검사(`toContain('halfvec(3072)')`)하지만 이는 테스트 assertion 이지 실 쿼리 실행이 아니다.
- 제안: 해당 없음.

**[INFO] 2. 하드코딩된 시크릿**
- 위치: `llm.service.spec.ts` 라인 1031, 1068 (`apiKey: 'encrypted'`)
- 상세: 테스트 픽스처에 `apiKey: 'encrypted'` 라는 플레이스홀더 문자열이 있으나, 이는 실제 키가 아닌 명시적 더미값이며 테스트 환경에서만 사용된다. 운영 코드에 전달되지 않는다.
- 제안: 해당 없음(허용 범위).

**[INFO] 3. 인증/인가**
- 위치: 전 파일
- 상세: 이번 변경에는 인증·인가 로직이 포함되지 않는다. spec 문서(`17-agent-memory.md §5`)에서 `workspace_id` 격리 의무(`AGM-07`)가 강조되어 있으며, 모든 쿼리가 `workspace_id` 필터를 강제한다는 설계 원칙이 재확인되었다. 해당 규약을 약화시키는 변경은 없다.
- 제안: 해당 없음.

**[INFO] 4. 입력 검증**
- 위치: `embedding-model-recommendation.ts` (`isKoreanRecommendedEmbeddingModel`)
- 상세: `modelId` 를 `undefined | null | string` 으로 받아 falsy 체크 후 정규식 매칭한다. 사용자가 임의 문자열을 전달해도 정규식이 서버 측 실행에 영향을 주지 않는다(순수 클라이언트 표시용). 입력 새니타이징이 필요한 경로가 아니다.
- 제안: 해당 없음.

**[INFO] 5. OWASP Top 10**
- 위치: 전 파일
- 상세: 이번 변경에서 OWASP Top 10 관련 취약점(A01~A10) 에 해당하는 패턴이 발견되지 않았다. 변경 범위가 테스트 코드·UI 라벨 유틸·spec 문서에 한정되어 있어 공격 표면 확장이 없다.
- 제안: 해당 없음.

**[INFO] 6. 암호화**
- 위치: 전 파일
- 상세: 암호화 알고리즘·평문 전송과 관련된 변경이 없다. 임베딩 벡터는 내부 처리용이며 전송 레이어 보안은 이번 변경 범위 밖이다.
- 제안: 해당 없음.

**[INFO] 7. 에러 처리 / 정보 노출**
- 위치: `embedding-model-combobox.test.tsx` 라인 1381~1383
- 상세: 기존 테스트(`shows a localized code-mapped message on load failure and never the raw server text`)가 서버 원본 에러 메시지(내부 엔드포인트 URL 등)가 UI 에 노출되지 않음을 **명시적으로 검증**한다. 이번 변경에서 해당 가드가 약화되거나 우회된 흔적이 없다.
- 제안: 해당 없음.

**[INFO] 8. 의존성 보안**
- 위치: 전 파일
- 상세: 이번 diff 에서 `package.json` / `package-lock.json` 신규 의존성 추가는 없다(`package-lock.json` 은 git-untracked 상태이나 diff 대상 아님). 알려진 취약점이 있는 라이브러리 추가가 확인되지 않는다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 임베딩 모델의 `inputType`('query'/'document') 배선 계약을 테스트 코드로 고정하고, 한국어 추천 배지 라벨 생성 로직을 순수함수로 추출하며, 관련 spec 문서를 갱신하는 작업이다. 운영 코드에 대한 직접 변경이 없고, 보안 경계(인증/인가·입력 검증·SQL 파라미터화·에러 노출 억제)를 약화시키는 패턴이 발견되지 않았다. 테스트 픽스처의 `apiKey: 'encrypted'` 는 실제 시크릿이 아닌 명시적 더미값으로 위험이 없다. 전반적으로 보안 관점에서 우려 사항이 없는 변경이다.

## 위험도

NONE

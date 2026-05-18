# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** 테스트 코드의 `fs.readFileSync` 를 통한 임의 파일 읽기 — 경로 탐색 위험 낮음
  - 위치: `backend-labels.test.ts` 의 `walkSchemaFiles` / `nodes-coverage.test.ts` 의 `collectNodeSchemaFiles`
  - 상세: 두 함수 모두 `fs.readdirSync` 로 디렉토리를 탐색하고 `fs.readFileSync` 로 소스 파일을 읽는다. 탐색 루트(`backendNodesRoot`, `docsRoot`)는 `path.resolve(__dirname, ...)` 로 저장소 내 고정 경로로 계산되므로, 일반적인 경로 탐색 공격 면은 없다. 그러나 외부 입력을 경로에 합성하는 로직이 없어 현 코드에서는 실질적 위험이 없다. 테스트 환경이 아닌 프로덕션 코드에 동일 패턴이 사용되면 위험하므로 참고로 기재한다.
  - 제안: 현 수준 유지. 프로덕션 코드에서 유사 패턴을 복붙할 경우 경로 입력 검증을 반드시 추가할 것.

- **[INFO]** 정규식 기반 TypeScript 소스 정적 파싱 — ReDoS 위험 미미
  - 위치: `backend-labels.test.ts` L565-L585 (`extractWarningMessages`), L598-L616 (`extractNodeMetadataTopFields`), L618-L661 (`collectTopLevelStringFields`)
  - 상세: 소스 텍스트를 정규식과 수동 파서로 처리한다. `startRe.exec` 의 주요 패턴(`/\bwarningRules\s*:\s*\[/g`, `/\bNodeMetadata\s*:\s*NodeComponentMetadata\s*=\s*\{/g`)은 단순 앵커 패턴이라 catastrophic backtracking 위험이 없다. 내부 `msgRe` (`/\bmessage\s*:\s*(['"\`])((?:\\.|(?!\1).)*)\1/g`) 도 소유적 수량사가 없지만, 입력이 신뢰된 저장소 내 소스 파일에 한정되므로 실질적 ReDoS 위협이 없다.
  - 제안: 테스트 컨텍스트이므로 현 수준 유지. 만약 외부 제출 텍스트를 파싱하는 프로덕션 코드로 이식될 경우 ReDoS 취약한 백트래킹 패턴을 검토할 것.

- **[INFO]** `hardcoded-korean-ratchet.test.ts` 의 `BASELINE_UPDATE=1` 환경변수로 기동 시 파일 쓰기 발생
  - 위치: `hardcoded-korean-ratchet.test.ts` L1167-L1187 (`writeBaseline`)
  - 상세: `process.env.BASELINE_UPDATE === "1"` 일 때 `fs.writeFileSync(baselinePath, ...)` 로 `hardcoded-korean-baseline.json` 을 덮어쓴다. `baselinePath` 는 `path.resolve(__dirname, "hardcoded-korean-baseline.json")` 로 테스트 파일과 같은 디렉토리에 고정되어 있어 경로 주입 위험은 없다. CI에서 `BASELINE_UPDATE=1` 이 의도치 않게 설정되면 baseline 파일이 변조되어 ratchet 가드가 무력화될 수 있다.
  - 제안: CI 파이프라인에서 `BASELINE_UPDATE` 환경변수가 명시적으로 설정되지 않도록 확인한다. `BASELINE_UPDATE=1` 갱신은 로컬 개발자가 의식적으로 실행하는 것으로 제한하고, CI는 기본값(환경변수 미설정)으로만 실행하도록 운영 정책을 명문화하는 것을 권장한다.

- **[INFO]** `backend-labels.ts` 에서 `WARNING_KO`, `NODE_LABEL_KO`, `NODE_DESCRIPTION_KO` 를 새로 `export` 로 노출
  - 위치: `backend-labels.ts` diff — `const WARNING_KO` → `export const WARNING_KO`, 동일하게 `NODE_LABEL_KO`, `NODE_DESCRIPTION_KO`
  - 상세: 기존에 모듈-내부 상수였던 세 테이블이 공개 API 로 변경된다. 테스트 파일에서 임포트하기 위한 변경이며, 내용은 한국어 번역 문자열 매핑일 뿐이므로 민감 정보 노출 위험은 없다. 다만 이 테이블들이 이제 외부에서 직접 변조 가능한 레퍼런스가 되므로, 향후 런타임에서 읽기 전용 불변성이 필요하다면 `as const` assertion 이나 `Object.freeze` 를 고려할 수 있다. 현재 TypeScript 타입은 `Record<string, string>` 이어서 외부 코드가 키를 추가·삭제할 수 있다.
  - 제안: 프로덕션 런타임 코드가 이 테이블을 변조하지 않는다면 현재 수준으로 충분하다. 불변 보장이 필요한 경우 `export const WARNING_KO = { ... } as const satisfies Record<string, string>` 으로 선언을 강화하거나 `Object.freeze` 를 적용할 것.

- **[INFO]** `hardcoded-korean-baseline.json` 내 `_updateCommand` 필드 — 명령 주입 위험 없음 (문서용 메타데이터)
  - 위치: `hardcoded-korean-baseline.json` L3 (`"_updateCommand": "BASELINE_UPDATE=1 npm test -- hardcoded-korean-ratchet"`)
  - 상세: 이 필드는 JSON 내 사람이 읽는 안내 문자열이며, 코드에서 `exec` 또는 `spawn` 으로 실행되지 않는다. `loadBaseline()` 에서 `JSON.parse` 후 `files` 키만 접근하므로 명령 주입 위험이 없다. 참고로 기재한다.
  - 제안: 현 수준 유지.

## 요약

이번 변경은 i18n 가드 확장을 위한 테스트 파일 3종(`backend-labels.test.ts`, `nodes-coverage.test.ts`, `hardcoded-korean-ratchet.test.ts`), baseline JSON 파일, `backend-labels.ts` 일부 export 변경, 그리고 `PROJECT.md` / plan 문서 업데이트로 구성된다. 검토 대상 코드는 모두 테스트·문서·번역 매핑 파일에 해당하며, 인젝션 취약점, 하드코딩된 시크릿, 인증/인가 로직, 외부 사용자 입력 처리, 암호화 알고리즘 등 고위험 보안 요소가 포함되지 않는다. 파일 시스템 접근은 모두 저장소 내 고정 경로로 한정되어 있고, 환경변수 기반 baseline 덮어쓰기는 CI 운영 정책으로 충분히 제어 가능한 수준이다. 전반적으로 보안 위험이 극히 낮은 변경이며, 발견된 항목은 모두 INFO 수준의 참고 사항이다.

## 위험도

LOW

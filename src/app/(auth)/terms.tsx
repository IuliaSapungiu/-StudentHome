import { LegalScreen } from '@/components/LegalScreen';

export default function TermsScreen() {
  return (
    <LegalScreen
      title="Terms and Conditions"
      paragraphs={[
        'These are placeholder terms for the StudentHouse demo.',
        'The final Terms and Conditions will describe how students and landlords may use the service, how listings are published, and each party\'s responsibilities.',
        'Landlords remain responsible for their own legal and tax obligations.',
      ]}
    />
  );
}
